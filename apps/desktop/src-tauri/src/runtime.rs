use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

use crate::credentials::read_secret;

const ANTHROPIC_VERSION: &str = "2023-06-01";
const ANTHROPIC_MAX_TOKENS: u32 = 4096;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePromptRequest {
    provider: String,
    model: String,
    instruction_role: String,
    prompt: String,
    runtime_input: Option<String>,
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

fn normalize_provider(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai"),
        "anthropic" => Ok("anthropic"),
        "google" => Ok("google"),
        _ => Err("Unsupported provider.".to_string()),
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

fn build_openai_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    if request.instruction_role == "user" {
        return Ok(json!({
            "model": request.model,
            "input": request.prompt,
            "store": false
        }));
    }

    Ok(json!({
        "model": request.model,
        "instructions": request.prompt,
        "input": runtime_input(request)?,
        "store": false
    }))
}

fn build_anthropic_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    if request.instruction_role == "user" {
        return Ok(json!({
            "model": request.model,
            "max_tokens": ANTHROPIC_MAX_TOKENS,
            "messages": [{
                "role": "user",
                "content": request.prompt
            }]
        }));
    }

    Ok(json!({
        "model": request.model,
        "max_tokens": ANTHROPIC_MAX_TOKENS,
        "system": request.prompt,
        "messages": [{
            "role": "user",
            "content": runtime_input(request)?
        }]
    }))
}

fn build_google_payload(request: &ExecutePromptRequest) -> Result<Value, String> {
    if request.instruction_role == "user" {
        return Ok(json!({
            "contents": [{
                "role": "user",
                "parts": [{ "text": request.prompt }]
            }]
        }));
    }

    Ok(json!({
        "system_instruction": {
            "parts": [{ "text": request.prompt }]
        },
        "contents": [{
            "role": "user",
            "parts": [{ "text": runtime_input(request)? }]
        }]
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

#[cfg(test)]
mod tests {
    use super::{
        build_anthropic_payload, build_google_payload, build_openai_payload, parse_anthropic,
        parse_google, parse_openai, ExecutePromptRequest,
    };
    use serde_json::json;

    fn request(provider: &str, role: &str, runtime_input: Option<&str>) -> ExecutePromptRequest {
        ExecutePromptRequest {
            provider: provider.to_string(),
            model: "model-id".to_string(),
            instruction_role: role.to_string(),
            prompt: "Compiled prompt".to_string(),
            runtime_input: runtime_input.map(str::to_string),
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
        assert_eq!(payload["input"], "Review this.");
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
