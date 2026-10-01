use futures_util::StreamExt;
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{ipc::Channel, State};
use tokio::sync::Notify;

use crate::credentials::read_secret;

const ANTHROPIC_VERSION: &str = "2023-06-01";
const ANTHROPIC_DEFAULT_MAX_TOKENS: u32 = 16_000;

#[derive(Default)]
struct RunCancellation {
    cancelled: AtomicBool,
    notify: Notify,
}

impl RunCancellation {
    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        self.notify.notify_one();
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    async fn cancelled(&self) {
        if self.is_cancelled() {
            return;
        }

        self.notify.notified().await;
    }
}

#[derive(Default)]
pub struct RuntimeState {
    runs: Mutex<HashMap<String, Arc<RunCancellation>>>,
}

#[derive(Clone, Serialize)]
#[serde(
    tag = "event",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ProviderStreamEvent {
    Started {
        run_id: String,
    },
    Delta {
        text: String,
    },
    Usage {
        input_tokens: Option<u64>,
        output_tokens: Option<u64>,
    },
    Error {
        message: String,
    },
    Finished {
        cancelled: bool,
    },
}

#[derive(Default)]
struct StreamUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
}

impl SseDecoder {
    fn push(&mut self, chunk: &[u8]) -> Result<Vec<Value>, String> {
        self.buffer.extend_from_slice(chunk);
        let mut events = Vec::new();

        while let Some((index, delimiter_len)) = self.boundary() {
            let block = self.buffer[..index].to_vec();
            self.buffer.drain(..index + delimiter_len);

            let block = String::from_utf8(block)
                .map_err(|_| "Provider stream contained invalid UTF-8.".to_string())?;
            let data = block
                .lines()
                .filter_map(|line| line.strip_prefix("data:"))
                .map(str::trim_start)
                .collect::<Vec<_>>()
                .join("\n");

            if data.is_empty() || data == "[DONE]" {
                continue;
            }

            let value = serde_json::from_str::<Value>(&data)
                .map_err(|_| "Provider stream contained invalid JSON.".to_string())?;
            events.push(value);
        }

        Ok(events)
    }

    fn boundary(&self) -> Option<(usize, usize)> {
        for index in 0..self.buffer.len() {
            if self.buffer.get(index..index + 2) == Some(b"\n\n") {
                return Some((index, 2));
            }

            if self.buffer.get(index..index + 4) == Some(b"\r\n\r\n") {
                return Some((index, 4));
            }
        }

        None
    }
}

fn openai_stream_event(
    event: &Value,
    usage: &mut StreamUsage,
) -> Result<Option<String>, String> {
    match event.get("type").and_then(Value::as_str) {
        Some("response.output_text.delta") => Ok(event
            .get("delta")
            .and_then(Value::as_str)
            .map(str::to_string)),
        Some("response.completed") => {
            usage.input_tokens = event
                .pointer("/response/usage/input_tokens")
                .and_then(Value::as_u64);
            usage.output_tokens = event
                .pointer("/response/usage/output_tokens")
                .and_then(Value::as_u64);
            Ok(None)
        }
        Some("error") => Err(event
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("OpenAI stream failed.")
            .to_string()),
        Some("response.failed") | Some("response.incomplete") => Err(event
            .pointer("/response/error/message")
            .and_then(Value::as_str)
            .unwrap_or("OpenAI response did not complete.")
            .to_string()),
        _ => Ok(None),
    }
}

fn anthropic_stream_event(
    event: &Value,
    usage: &mut StreamUsage,
) -> Result<Option<String>, String> {
    match event.get("type").and_then(Value::as_str) {
        Some("message_start") => {
            usage.input_tokens = event
                .pointer("/message/usage/input_tokens")
                .and_then(Value::as_u64);
            Ok(None)
        }
        Some("content_block_delta")
            if event.pointer("/delta/type").and_then(Value::as_str) == Some("text_delta") =>
        {
            Ok(event
                .pointer("/delta/text")
                .and_then(Value::as_str)
                .map(str::to_string))
        }
        Some("message_delta") => {
            usage.output_tokens = event
                .pointer("/usage/output_tokens")
                .and_then(Value::as_u64);
            Ok(None)
        }
        Some("error") => Err(event
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("Anthropic stream failed.")
            .to_string()),
        _ => Ok(None),
    }
}

fn google_stream_event(
    event: &Value,
    usage: &mut StreamUsage,
) -> Result<Option<String>, String> {
    if let Some(message) = event.pointer("/error/message").and_then(Value::as_str) {
        return Err(message.to_string());
    }

    usage.input_tokens = event
        .pointer("/usageMetadata/promptTokenCount")
        .and_then(Value::as_u64)
        .or(usage.input_tokens);
    usage.output_tokens = event
        .pointer("/usageMetadata/candidatesTokenCount")
        .and_then(Value::as_u64)
        .or(usage.output_tokens);

    let text = event
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");

    Ok((!text.is_empty()).then_some(text))
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeMessage {
    role: String,
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePromptRequest {
    provider: String,
    model: String,
    instruction_role: String,
    prompt: String,
    max_output_tokens: Option<u32>,
    runtime_input: Option<String>,
    #[serde(default)]
    history: Vec<RuntimeMessage>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePromptResponse {
    provider: String,
    model: String,
    text: String,
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenCountResponse {
    provider: String,
    model: String,
    input_tokens: u64,
}

fn normalize_provider(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai"),
        "anthropic" => Ok("anthropic"),
        "google" => Ok("google"),
        _ => Err("Unsupported provider.".to_string()),
    }
}

fn validated_history(request: &ExecutePromptRequest) -> Result<Vec<RuntimeMessage>, String> {
    request
        .history
        .iter()
        .map(|message| {
            let role = message.role.trim().to_ascii_lowercase();
            if role != "user" && role != "assistant" {
                return Err("Conversation history contains an unsupported role.".to_string());
            }

            let text = message.text.trim();
            if text.is_empty() {
                return Err("Conversation history contains an empty message.".to_string());
            }

            Ok(RuntimeMessage {
                role,
                text: text.to_string(),
            })
        })
        .collect()
}

fn validated_max_output_tokens(request: &ExecutePromptRequest) -> Result<Option<u32>, String> {
    match request.max_output_tokens {
        Some(0) => Err("Maximum output tokens must be greater than zero.".to_string()),
        value => Ok(value),
    }
}

fn runtime_input(request: &ExecutePromptRequest) -> Result<&str, String> {
    request
        .runtime_input
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "This instruction surface needs runtime input before it can be executed.".to_string()
        })
}

fn openai_input_message(message: &RuntimeMessage) -> Value {
    json!({
        "role": message.role,
        "content": [{
            "type": if message.role == "assistant" { "output_text" } else { "input_text" },
            "text": message.text
        }]
    })
}

fn build_openai_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    let max_output_tokens = validated_max_output_tokens(request)?;

    if request.instruction_role == "user" {
        if !request.history.is_empty() || request.runtime_input.is_some() {
            return Err("User prompt surfaces do not support continuation history.".to_string());
        }

        let mut payload = json!({
            "model": request.model,
            "input": request.prompt,
            "store": false
        });

        if let Some(limit) = max_output_tokens {
            payload["max_output_tokens"] = json!(limit);
        }

        return Ok(payload);
    }

    let mut input = validated_history(request)?
        .iter()
        .map(openai_input_message)
        .collect::<Vec<_>>();
    input.push(openai_input_message(&RuntimeMessage {
        role: "user".to_string(),
        text: runtime_input(request)?.to_string(),
    }));

    let mut payload = json!({
        "model": request.model,
        "instructions": request.prompt,
        "input": input,
        "store": false
    });

    if let Some(limit) = max_output_tokens {
        payload["max_output_tokens"] = json!(limit);
    }

    Ok(payload)
}

fn anthropic_message(message: &RuntimeMessage) -> Value {
    json!({
        "role": message.role,
        "content": message.text
    })
}

fn build_anthropic_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    let max_tokens = validated_max_output_tokens(request)?
        .unwrap_or(ANTHROPIC_DEFAULT_MAX_TOKENS);

    if request.instruction_role == "user" {
        if !request.history.is_empty() || request.runtime_input.is_some() {
            return Err("User prompt surfaces do not support continuation history.".to_string());
        }

        return Ok(json!({
            "model": request.model,
            "max_tokens": max_tokens,
            "messages": [{
                "role": "user",
                "content": request.prompt
            }]
        }));
    }

    let mut messages = validated_history(request)?
        .iter()
        .map(anthropic_message)
        .collect::<Vec<_>>();
    messages.push(anthropic_message(&RuntimeMessage {
        role: "user".to_string(),
        text: runtime_input(request)?.to_string(),
    }));

    Ok(json!({
        "model": request.model,
        "max_tokens": max_tokens,
        "system": request.prompt,
        "messages": messages
    }))
}

fn google_content(message: &RuntimeMessage) -> Value {
    json!({
        "role": if message.role == "assistant" { "model" } else { "user" },
        "parts": [{ "text": message.text }]
    })
}

fn build_google_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    let max_output_tokens = validated_max_output_tokens(request)?;

    if request.instruction_role == "user" {
        if !request.history.is_empty() || request.runtime_input.is_some() {
            return Err("User prompt surfaces do not support continuation history.".to_string());
        }

        let mut payload = json!({
            "contents": [{
                "role": "user",
                "parts": [{ "text": request.prompt }]
            }]
        });

        if let Some(limit) = max_output_tokens {
            payload["generationConfig"] = json!({
                "maxOutputTokens": limit
            });
        }

        return Ok(payload);
    }

    let mut contents = validated_history(request)?
        .iter()
        .map(google_content)
        .collect::<Vec<_>>();
    contents.push(google_content(&RuntimeMessage {
        role: "user".to_string(),
        text: runtime_input(request)?.to_string(),
    }));

    let mut payload = json!({
        "system_instruction": {
            "parts": [{ "text": request.prompt }]
        },
        "contents": contents
    });

    if let Some(limit) = max_output_tokens {
        payload["generationConfig"] = json!({
            "maxOutputTokens": limit
        });
    }

    Ok(payload)
}


fn build_anthropic_count_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    let mut payload = build_anthropic_payload(request)?;

    if let Some(object) = payload.as_object_mut() {
        object.remove("max_tokens");
    }

    Ok(payload)
}

fn build_google_count_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    let mut payload = build_google_payload(request)?;

    if let Some(object) = payload.as_object_mut() {
        object.remove("generationConfig");
    }

    Ok(json!({
        "generateContentRequest": payload
    }))
}

fn provider_error_message(status: u16, body: &Value) -> String {
    let message = body
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| body.get("message").and_then(Value::as_str));

    match message {
        Some(message) if !message.trim().is_empty() => {
            format!("Provider returned HTTP {}: {}", status, message.trim())
        }
        _ => format!("Provider returned HTTP {}.", status),
    }
}

async fn response_json(response: Response) -> Result<Value, String> {
    let status = response.status();

    let body = response
        .json::<Value>()
        .await
        .map_err(|_| format!("Provider returned HTTP {} with an unreadable response.", status.as_u16()))?;

    if !status.is_success() {
        return Err(provider_error_message(status.as_u16(), &body));
    }

    Ok(body)
}

fn parse_openai(body: &Value) -> Result<(String, Option<u64>, Option<u64>), String> {
    let text = body
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("content").and_then(Value::as_array))
        .flatten()
        .filter(|part| part.get("type").and_then(Value::as_str) == Some("output_text"))
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err("OpenAI returned no text output.".to_string());
    }

    let input_tokens = body.pointer("/usage/input_tokens").and_then(Value::as_u64);
    let output_tokens = body.pointer("/usage/output_tokens").and_then(Value::as_u64);

    Ok((text, input_tokens, output_tokens))
}

fn parse_anthropic(body: &Value) -> Result<(String, Option<u64>, Option<u64>), String> {
    let text = body
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|part| part.get("type").and_then(Value::as_str) == Some("text"))
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err("Anthropic returned no text output.".to_string());
    }

    let input_tokens = body.pointer("/usage/input_tokens").and_then(Value::as_u64);
    let output_tokens = body.pointer("/usage/output_tokens").and_then(Value::as_u64);

    Ok((text, input_tokens, output_tokens))
}

fn parse_google(body: &Value) -> Result<(String, Option<u64>, Option<u64>), String> {
    let text = body
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err("Google returned no text output.".to_string());
    }

    let input_tokens = body
        .pointer("/usageMetadata/promptTokenCount")
        .and_then(Value::as_u64);
    let output_tokens = body
        .pointer("/usageMetadata/candidatesTokenCount")
        .and_then(Value::as_u64);

    Ok((text, input_tokens, output_tokens))
}

async fn execute_openai(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
) -> Result<ExecutePromptResponse, String> {
    let body = response_json(
        client
            .post("https://api.openai.com/v1/responses")
            .bearer_auth(secret)
            .json(&build_openai_payload(request)?)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;

    let (text, input_tokens, output_tokens) = parse_openai(&body)?;

    Ok(ExecutePromptResponse {
        provider: "openai".to_string(),
        model: request.model.clone(),
        text,
        input_tokens,
        output_tokens,
    })
}

async fn execute_anthropic(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
) -> Result<ExecutePromptResponse, String> {
    let body = response_json(
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", secret)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&build_anthropic_payload(request)?)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;

    let (text, input_tokens, output_tokens) = parse_anthropic(&body)?;

    Ok(ExecutePromptResponse {
        provider: "anthropic".to_string(),
        model: request.model.clone(),
        text,
        input_tokens,
        output_tokens,
    })
}

async fn execute_google(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
) -> Result<ExecutePromptResponse, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        request.model
    );

    let body = response_json(
        client
            .post(url)
            .header("x-goog-api-key", secret)
            .json(&build_google_payload(request)?)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;

    let (text, input_tokens, output_tokens) = parse_google(&body)?;

    Ok(ExecutePromptResponse {
        provider: "google".to_string(),
        model: request.model.clone(),
        text,
        input_tokens,
        output_tokens,
    })
}

async fn count_anthropic_tokens(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
) -> Result<TokenCountResponse, String> {
    let body = response_json(
        client
            .post("https://api.anthropic.com/v1/messages/count_tokens")
            .header("x-api-key", secret)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&build_anthropic_count_payload(request)?)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;

    let input_tokens = body
        .get("input_tokens")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Anthropic returned no token count.".to_string())?;

    Ok(TokenCountResponse {
        provider: "anthropic".to_string(),
        model: request.model.clone(),
        input_tokens,
    })
}

async fn count_google_tokens(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
) -> Result<TokenCountResponse, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:countTokens",
        request.model
    );

    let body = response_json(
        client
            .post(url)
            .header("x-goog-api-key", secret)
            .json(&build_google_count_payload(request)?)
            .send()
            .await
            .map_err(network_error)?,
    )
    .await?;

    let input_tokens = body
        .get("totalTokens")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Google returned no token count.".to_string())?;

    Ok(TokenCountResponse {
        provider: "google".to_string(),
        model: request.model.clone(),
        input_tokens,
    })
}


async fn stream_response(
    response: Response,
    provider: &str,
    on_event: &Channel<ProviderStreamEvent>,
    cancellation: &RunCancellation,
) -> Result<StreamUsage, String> {
    let status = response.status();

    if !status.is_success() {
        let body = response
            .json::<Value>()
            .await
            .unwrap_or_else(|_| json!({}));
        return Err(provider_error_message(status.as_u16(), &body));
    }

    let mut decoder = SseDecoder::default();
    let mut usage = StreamUsage::default();
    let mut stream = response.bytes_stream();

    loop {
        let next = tokio::select! {
            _ = cancellation.cancelled() => return Ok(usage),
            next = stream.next() => next,
        };

        let Some(chunk) = next else {
            break;
        };

        if cancellation.is_cancelled() {
            return Ok(usage);
        }

        let chunk = chunk.map_err(network_error)?;

        for event in decoder.push(&chunk)? {
            if cancellation.is_cancelled() {
                return Ok(usage);
            }

            let delta = match provider {
                "openai" => openai_stream_event(&event, &mut usage)?,
                "anthropic" => anthropic_stream_event(&event, &mut usage)?,
                "google" => google_stream_event(&event, &mut usage)?,
                _ => None,
            };

            if let Some(text) = delta {
                let _ = on_event.send(ProviderStreamEvent::Delta { text });
            }
        }
    }

    Ok(usage)
}

async fn stream_openai(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
    on_event: &Channel<ProviderStreamEvent>,
    cancellation: &RunCancellation,
) -> Result<StreamUsage, String> {
    let mut payload = build_openai_payload(request)?;
    payload["stream"] = json!(true);

    let response = tokio::select! {
        _ = cancellation.cancelled() => return Ok(StreamUsage::default()),
        response = client
            .post("https://api.openai.com/v1/responses")
            .bearer_auth(secret)
            .json(&payload)
            .send() => response.map_err(network_error)?,
    };

    stream_response(response, "openai", on_event, cancellation).await
}

async fn stream_anthropic(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
    on_event: &Channel<ProviderStreamEvent>,
    cancellation: &RunCancellation,
) -> Result<StreamUsage, String> {
    let mut payload = build_anthropic_payload(request)?;
    payload["stream"] = json!(true);

    let response = tokio::select! {
        _ = cancellation.cancelled() => return Ok(StreamUsage::default()),
        response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", secret)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&payload)
            .send() => response.map_err(network_error)?,
    };

    stream_response(response, "anthropic", on_event, cancellation).await
}

async fn stream_google(
    client: &Client,
    request: &ExecutePromptRequest,
    secret: &str,
    on_event: &Channel<ProviderStreamEvent>,
    cancellation: &RunCancellation,
) -> Result<StreamUsage, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse",
        request.model
    );

    let response = tokio::select! {
        _ = cancellation.cancelled() => return Ok(StreamUsage::default()),
        response = client
            .post(url)
            .header("x-goog-api-key", secret)
            .json(&build_google_payload(request)?)
            .send() => response.map_err(network_error)?,
    };

    stream_response(response, "google", on_event, cancellation).await
}

fn network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "Provider request timed out.".to_string()
    } else {
        "Could not reach the provider.".to_string()
    }
}

#[tauri::command]
pub async fn execute_provider_prompt(
    request: ExecutePromptRequest,
) -> Result<ExecutePromptResponse, String> {
    let provider = normalize_provider(&request.provider)?;

    if request.model.trim().is_empty() || request.prompt.trim().is_empty() {
        return Err("Model and compiled prompt are required.".to_string());
    }

    let secret = read_secret(provider)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| error.to_string())?;

    match provider {
        "openai" => execute_openai(&client, &request, &secret).await,
        "anthropic" => execute_anthropic(&client, &request, &secret).await,
        "google" => execute_google(&client, &request, &secret).await,
        _ => unreachable!(),
    }
}

#[tauri::command]
pub async fn count_provider_tokens(
    request: ExecutePromptRequest,
) -> Result<TokenCountResponse, String> {
    let provider = normalize_provider(&request.provider)?;

    if request.model.trim().is_empty() || request.prompt.trim().is_empty() {
        return Err("Model and compiled prompt are required.".to_string());
    }

    if provider == "openai" {
        return Err(
            "Exact OpenAI preflight token counting is not available in Humanizer yet.".to_string(),
        );
    }

    let secret = read_secret(provider)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;

    match provider {
        "anthropic" => count_anthropic_tokens(&client, &request, &secret).await,
        "google" => count_google_tokens(&client, &request, &secret).await,
        _ => unreachable!(),
    }
}


#[tauri::command]
pub async fn stream_provider_prompt(
    request: ExecutePromptRequest,
    run_id: String,
    on_event: Channel<ProviderStreamEvent>,
    state: State<'_, RuntimeState>,
) -> Result<(), String> {
    let provider = normalize_provider(&request.provider)?;

    if request.model.trim().is_empty() || request.prompt.trim().is_empty() {
        return Err("Model and compiled prompt are required.".to_string());
    }

    if run_id.trim().is_empty() {
        return Err("Run id is required.".to_string());
    }

    let secret = read_secret(provider)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|error| error.to_string())?;

    let cancellation = Arc::new(RunCancellation::default());
    {
        let mut runs = state
            .runs
            .lock()
            .map_err(|_| "Runtime state is unavailable.".to_string())?;

        if runs.contains_key(&run_id) {
            return Err("A run with this id already exists.".to_string());
        }

        runs.insert(run_id.clone(), Arc::clone(&cancellation));
    }

    let _ = on_event.send(ProviderStreamEvent::Started {
        run_id: run_id.clone(),
    });

    let result = match provider {
        "openai" => stream_openai(&client, &request, &secret, &on_event, &cancellation).await,
        "anthropic" => stream_anthropic(&client, &request, &secret, &on_event, &cancellation).await,
        "google" => stream_google(&client, &request, &secret, &on_event, &cancellation).await,
        _ => unreachable!(),
    };

    if let Ok(mut runs) = state.runs.lock() {
        runs.remove(&run_id);
    }

    let was_cancelled = cancellation.is_cancelled();

    match result {
        Ok(usage) => {
            let _ = on_event.send(ProviderStreamEvent::Usage {
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
            });
        }
        Err(message) => {
            let _ = on_event.send(ProviderStreamEvent::Error { message });
        }
    }

    let _ = on_event.send(ProviderStreamEvent::Finished {
        cancelled: was_cancelled,
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_provider_stream(
    run_id: String,
    state: State<'_, RuntimeState>,
) -> Result<bool, String> {
    let runs = state
        .runs
        .lock()
        .map_err(|_| "Runtime state is unavailable.".to_string())?;

    let Some(cancellation) = runs.get(&run_id) else {
        return Ok(false);
    };

    cancellation.cancel();
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{
        anthropic_stream_event, build_anthropic_count_payload, build_anthropic_payload,
        build_google_count_payload, build_google_payload, build_openai_payload,
        google_stream_event, openai_stream_event, parse_anthropic, parse_google, parse_openai,
        ExecutePromptRequest, RuntimeMessage, SseDecoder, StreamUsage,
    };
    use serde_json::json;

    fn request(provider: &str, role: &str, runtime_input: Option<&str>) -> ExecutePromptRequest {
        ExecutePromptRequest {
            provider: provider.to_string(),
            model: "model-id".to_string(),
            instruction_role: role.to_string(),
            prompt: "Compiled prompt".to_string(),
            max_output_tokens: None,
            runtime_input: runtime_input.map(str::to_string),
            history: Vec::new(),
        }
    }

    #[test]
    fn openai_user_prompt_maps_to_input() {
        let payload = build_openai_payload(&request("openai", "user", None)).unwrap();
        assert_eq!(payload["input"], "Compiled prompt");
        assert_eq!(payload["store"], false);
        assert!(payload.get("instructions").is_none());
    }

    #[test]
    fn openai_instruction_requires_runtime_input() {
        let missing = build_openai_payload(&request("openai", "developer", None));
        assert!(missing.is_err());

        let payload =
            build_openai_payload(&request("openai", "developer", Some("Review this."))).unwrap();
        assert_eq!(payload["instructions"], "Compiled prompt");
        assert_eq!(payload["input"][0]["role"], "user");
        assert_eq!(payload["input"][0]["content"][0]["text"], "Review this.");
    }

    #[test]
    fn provider_payloads_preserve_conversation_history() {
        let history = vec![
            RuntimeMessage {
                role: "user".to_string(),
                text: "First question".to_string(),
            },
            RuntimeMessage {
                role: "assistant".to_string(),
                text: "First answer".to_string(),
            },
        ];

        let mut openai = request("openai", "developer", Some("Follow up"));
        openai.history = history.clone();
        let openai_payload = build_openai_payload(&openai).unwrap();
        assert_eq!(openai_payload["input"][0]["role"], "user");
        assert_eq!(openai_payload["input"][1]["role"], "assistant");
        assert_eq!(openai_payload["input"][2]["content"][0]["text"], "Follow up");

        let mut anthropic = request("anthropic", "system", Some("Follow up"));
        anthropic.history = history.clone();
        let anthropic_payload = build_anthropic_payload(&anthropic).unwrap();
        assert_eq!(anthropic_payload["messages"][0]["role"], "user");
        assert_eq!(anthropic_payload["messages"][1]["role"], "assistant");
        assert_eq!(anthropic_payload["messages"][2]["content"], "Follow up");

        let mut google = request("google", "system", Some("Follow up"));
        google.history = history;
        let google_payload = build_google_payload(&google).unwrap();
        assert_eq!(google_payload["contents"][0]["role"], "user");
        assert_eq!(google_payload["contents"][1]["role"], "model");
        assert_eq!(google_payload["contents"][2]["parts"][0]["text"], "Follow up");
    }

    #[test]
    fn user_prompt_surfaces_reject_continuation_history() {
        let mut user = request("openai", "user", None);
        user.history.push(RuntimeMessage {
            role: "assistant".to_string(),
            text: "Old answer".to_string(),
        });

        assert!(build_openai_payload(&user).is_err());
    }

    #[test]
    fn provider_payloads_apply_custom_output_budgets() {
        let mut openai = request("openai", "developer", Some("Review this."));
        openai.max_output_tokens = Some(12_345);
        let openai_payload = build_openai_payload(&openai).unwrap();
        assert_eq!(openai_payload["max_output_tokens"], 12_345);

        let mut anthropic = request("anthropic", "system", Some("Review this."));
        anthropic.max_output_tokens = Some(23_456);
        let anthropic_payload = build_anthropic_payload(&anthropic).unwrap();
        assert_eq!(anthropic_payload["max_tokens"], 23_456);

        let mut google = request("google", "system", Some("Review this."));
        google.max_output_tokens = Some(34_567);
        let google_payload = build_google_payload(&google).unwrap();
        assert_eq!(
            google_payload["generationConfig"]["maxOutputTokens"],
            34_567
        );
    }

    #[test]
    fn zero_output_budget_is_rejected() {
        let mut request = request("openai", "developer", Some("Review this."));
        request.max_output_tokens = Some(0);

        assert!(build_openai_payload(&request).is_err());
    }

    #[test]
    fn anthropic_maps_system_and_user_fields() {
        let payload =
            build_anthropic_payload(&request("anthropic", "system", Some("Review this."))).unwrap();
        assert_eq!(payload["system"], "Compiled prompt");
        assert_eq!(payload["messages"][0]["content"], "Review this.");
    }

    #[test]
    fn google_maps_system_instruction_and_contents() {
        let payload =
            build_google_payload(&request("google", "system", Some("Review this."))).unwrap();
        assert_eq!(
            payload["system_instruction"]["parts"][0]["text"],
            "Compiled prompt"
        );
        assert_eq!(payload["contents"][0]["parts"][0]["text"], "Review this.");
    }

    #[test]
    fn anthropic_token_count_uses_the_same_instruction_shape_without_output_budget() {
        let payload =
            build_anthropic_count_payload(&request("anthropic", "system", Some("Review this.")))
                .unwrap();

        assert_eq!(payload["model"], "model-id");
        assert_eq!(payload["system"], "Compiled prompt");
        assert_eq!(payload["messages"][0]["content"], "Review this.");
        assert!(payload.get("max_tokens").is_none());
    }

    #[test]
    fn google_token_count_wraps_the_generate_content_request() {
        let payload =
            build_google_count_payload(&request("google", "system", Some("Review this."))).unwrap();

        assert_eq!(
            payload["generateContentRequest"]["system_instruction"]["parts"][0]["text"],
            "Compiled prompt"
        );
        assert_eq!(
            payload["generateContentRequest"]["contents"][0]["parts"][0]["text"],
            "Review this."
        );
        assert!(payload["generateContentRequest"]
            .get("generationConfig")
            .is_none());
    }

    #[test]
    fn sse_decoder_handles_chunk_boundaries_and_done_markers() {
        let mut decoder = SseDecoder::default();
        assert!(decoder
            .push(b"event: delta\ndata: {\"type\":\"response.output_")
            .unwrap()
            .is_empty());

        let events = decoder
            .push(b"text.delta\",\"delta\":\"Hello\"}\n\ndata: [DONE]\n\n")
            .unwrap();

        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["delta"], "Hello");
    }

    #[test]
    fn stream_parsers_emit_only_visible_text_and_usage() {
        let mut openai_usage = StreamUsage::default();
        let openai_delta = json!({
            "type": "response.output_text.delta",
            "delta": "Hello"
        });
        assert_eq!(
            openai_stream_event(&openai_delta, &mut openai_usage).unwrap(),
            Some("Hello".to_string())
        );

        let mut anthropic_usage = StreamUsage::default();
        let thinking = json!({
            "type": "content_block_delta",
            "delta": { "type": "thinking_delta", "thinking": "private reasoning" }
        });
        assert_eq!(
            anthropic_stream_event(&thinking, &mut anthropic_usage).unwrap(),
            None
        );

        let text = json!({
            "type": "content_block_delta",
            "delta": { "type": "text_delta", "text": "Visible" }
        });
        assert_eq!(
            anthropic_stream_event(&text, &mut anthropic_usage).unwrap(),
            Some("Visible".to_string())
        );

        let mut google_usage = StreamUsage::default();
        let google = json!({
            "candidates": [{
                "content": { "parts": [{ "text": "Chunk" }] }
            }],
            "usageMetadata": {
                "promptTokenCount": 12,
                "candidatesTokenCount": 4
            }
        });
        assert_eq!(
            google_stream_event(&google, &mut google_usage).unwrap(),
            Some("Chunk".to_string())
        );
        assert_eq!(google_usage.input_tokens, Some(12));
        assert_eq!(google_usage.output_tokens, Some(4));
    }

    #[test]
    fn parses_provider_text_and_usage() {
        let openai = json!({
            "output": [{
                "type": "message",
                "content": [{ "type": "output_text", "text": "OpenAI answer" }]
            }],
            "usage": { "input_tokens": 12, "output_tokens": 7 }
        });
        let anthropic = json!({
            "content": [{ "type": "text", "text": "Claude answer" }],
            "usage": { "input_tokens": 14, "output_tokens": 9 }
        });
        let google = json!({
            "candidates": [{
                "content": {
                    "parts": [{ "text": "Gemini answer" }]
                }
            }],
            "usageMetadata": {
                "promptTokenCount": 16,
                "candidatesTokenCount": 11
            }
        });

        assert_eq!(parse_openai(&openai).unwrap(), ("OpenAI answer".to_string(), Some(12), Some(7)));
        assert_eq!(parse_anthropic(&anthropic).unwrap(), ("Claude answer".to_string(), Some(14), Some(9)));
        assert_eq!(parse_google(&google).unwrap(), ("Gemini answer".to_string(), Some(16), Some(11)));
    }
}
