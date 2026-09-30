use crate::credentials::read_secret;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTokenCount {
    provider: &'static str,
    model: String,
    total_tokens: u64,
}

#[derive(Deserialize)]
struct AnthropicCountResponse {
    input_tokens: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiCountResponse {
    total_tokens: u64,
}

fn validate_model_id(model: &str) -> Result<&str, String> {
    let model = model.trim();

    if model.is_empty()
        || !model
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
    {
        return Err("Invalid model id.".to_string());
    }

    Ok(model)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| error.to_string())
}

async fn count_anthropic(model: &str, text: &str) -> Result<u64, String> {
    let secret = read_secret("anthropic")?;
    let response = client()?
        .post("https://api.anthropic.com/v1/messages/count_tokens")
        .header("x-api-key", secret)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": text
                }
            ]
        }))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "Anthropic token count timed out.".to_string()
            } else {
                "Could not reach Anthropic token counting.".to_string()
            }
        })?;

    let status = response.status();

    if !status.is_success() {
        return Err(format!(
            "Anthropic token counting returned HTTP {}.",
            status.as_u16()
        ));
    }

    response
        .json::<AnthropicCountResponse>()
        .await
        .map(|body| body.input_tokens)
        .map_err(|_| "Anthropic returned an invalid token count response.".to_string())
}

async fn count_google(model: &str, text: &str) -> Result<u64, String> {
    let secret = read_secret("google")?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:countTokens",
        model
    );

    let response = client()?
        .post(url)
        .header("x-goog-api-key", secret)
        .json(&json!({
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": text
                        }
                    ]
                }
            ]
        }))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "Gemini token count timed out.".to_string()
            } else {
                "Could not reach Gemini token counting.".to_string()
            }
        })?;

    let status = response.status();

    if !status.is_success() {
        return Err(format!(
            "Gemini token counting returned HTTP {}.",
            status.as_u16()
        ));
    }

    response
        .json::<GeminiCountResponse>()
        .await
        .map(|body| body.total_tokens)
        .map_err(|_| "Gemini returned an invalid token count response.".to_string())
}

#[tauri::command]
pub async fn count_prompt_tokens(
    provider: String,
    model: String,
    text: String,
) -> Result<PromptTokenCount, String> {
    let model = validate_model_id(&model)?;

    if text.is_empty() {
        return Ok(PromptTokenCount {
            provider: match provider.as_str() {
                "anthropic" => "anthropic",
                "google" => "google",
                _ => return Err("Exact preflight token counting is unavailable for this provider.".to_string()),
            },
            model: model.to_string(),
            total_tokens: 0,
        });
    }

    let (provider, total_tokens) = match provider.as_str() {
        "anthropic" => ("anthropic", count_anthropic(model, &text).await?),
        "google" => ("google", count_google(model, &text).await?),
        _ => {
            return Err(
                "Exact preflight token counting is unavailable for this provider.".to_string(),
            )
        }
    };

    Ok(PromptTokenCount {
        provider,
        model: model.to_string(),
        total_tokens,
    })
}

#[cfg(test)]
mod tests {
    use super::validate_model_id;

    #[test]
    fn accepts_provider_model_ids() {
        assert_eq!(validate_model_id("claude-sonnet-5-5").unwrap(), "claude-sonnet-5-5");
        assert_eq!(validate_model_id("gemini-3.8-flash").unwrap(), "gemini-3.8-flash");
    }

    #[test]
    fn rejects_model_ids_that_can_escape_a_url_path() {
        assert!(validate_model_id("../models").is_err());
        assert!(validate_model_id("model?key=secret").is_err());
        assert!(validate_model_id("").is_err());
    }
}
