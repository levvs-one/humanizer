use keyring::{Entry, Error as KeyringError};
use serde::Serialize;
use std::time::Duration;

const SERVICE: &str = "dev.humanizer.credentials";
const PROVIDERS: [&str; 3] = ["openai", "anthropic", "google"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    provider: &'static str,
    configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderVerification {
    provider: &'static str,
    ok: bool,
    status_code: u16,
    message: String,
}

struct VerificationTarget {
    url: &'static str,
    auth: VerificationAuth,
}

enum VerificationAuth {
    Bearer,
    Anthropic,
    Google,
}

fn normalize_provider(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai"),
        "anthropic" => Ok("anthropic"),
        "google" => Ok("google"),
        _ => Err("Unsupported provider.".to_string()),
    }
}

fn verification_target(provider: &str) -> Result<VerificationTarget, String> {
    match normalize_provider(provider)? {
        "openai" => Ok(VerificationTarget {
            url: "https://api.openai.com/v1/models",
            auth: VerificationAuth::Bearer,
        }),
        "anthropic" => Ok(VerificationTarget {
            url: "https://api.anthropic.com/v1/models?limit=1",
            auth: VerificationAuth::Anthropic,
        }),
        "google" => Ok(VerificationTarget {
            url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
            auth: VerificationAuth::Google,
        }),
        _ => unreachable!(),
    }
}

fn entry(provider: &str) -> Result<Entry, String> {
    let provider = normalize_provider(provider)?;
    Entry::new(SERVICE, provider).map_err(|error| error.to_string())
}

pub(crate) fn read_secret(provider: &str) -> Result<String, String> {
    match entry(provider)?.get_password() {
        Ok(secret) if !secret.trim().is_empty() => Ok(secret),
        Ok(_) | Err(KeyringError::NoEntry) => Err("No stored API key for this provider.".to_string()),
        Err(error) => Err(error.to_string()),
    }
}

fn is_configured(provider: &'static str) -> Result<bool, String> {
    match entry(provider)?.get_password() {
        Ok(secret) => Ok(!secret.is_empty()),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn set_provider_api_key(provider: String, api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();

    if api_key.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    entry(&provider)?
        .set_password(api_key)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_provider_api_key(provider: String) -> Result<(), String> {
    let entry = entry(&provider)?;

    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn provider_credential_status() -> Result<Vec<CredentialStatus>, String> {
    PROVIDERS
        .iter()
        .map(|provider| {
            Ok(CredentialStatus {
                provider,
                configured: is_configured(provider)?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn verify_provider_api_key(
    provider: String,
) -> Result<ProviderVerification, String> {
    let normalized = normalize_provider(&provider)?;
    let secret = read_secret(normalized)?;
    let target = verification_target(normalized)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| error.to_string())?;

    let request = match target.auth {
        VerificationAuth::Bearer => client.get(target.url).bearer_auth(&secret),
        VerificationAuth::Anthropic => client
            .get(target.url)
            .header("x-api-key", &secret)
            .header("anthropic-version", "2023-06-01"),
        VerificationAuth::Google => client
            .get(target.url)
            .header("x-goog-api-key", &secret),
    };

    let response = request
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "Provider verification timed out.".to_string()
            } else {
                "Could not reach the provider.".to_string()
            }
        })?;

    let status = response.status();
    let ok = status.is_success();
    let message = if ok {
        "Credential verified.".to_string()
    } else if status.as_u16() == 401 || status.as_u16() == 403 {
        "Credential was rejected by the provider.".to_string()
    } else {
        format!("Provider returned HTTP {}.", status.as_u16())
    };

    Ok(ProviderVerification {
        provider: normalized,
        ok,
        status_code: status.as_u16(),
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::{normalize_provider, verification_target};

    #[test]
    fn accepts_supported_provider_ids_case_insensitively() {
        assert_eq!(normalize_provider("OpenAI").unwrap(), "openai");
        assert_eq!(normalize_provider(" anthropic ").unwrap(), "anthropic");
        assert_eq!(normalize_provider("GOOGLE").unwrap(), "google");
    }

    #[test]
    fn rejects_unknown_provider_ids() {
        assert!(normalize_provider("random-provider").is_err());
    }

    #[test]
    fn verification_targets_use_official_https_endpoints() {
        for provider in ["openai", "anthropic", "google"] {
            let target = verification_target(provider).unwrap();
            assert!(target.url.starts_with("https://"));
        }

        assert_eq!(
            verification_target("openai").unwrap().url,
            "https://api.openai.com/v1/models"
        );
        assert!(verification_target("anthropic")
            .unwrap()
            .url
            .starts_with("https://api.anthropic.com/v1/models"));
        assert!(verification_target("google")
            .unwrap()
            .url
            .starts_with("https://generativelanguage.googleapis.com/v1beta/models"));
    }
}
