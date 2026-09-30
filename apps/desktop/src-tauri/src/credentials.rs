use keyring::{Entry, Error as KeyringError};
use serde::Serialize;

const SERVICE: &str = "dev.humanizer.credentials";
const PROVIDERS: [&str; 3] = ["openai", "anthropic", "google"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    provider: &'static str,
    configured: bool,
}

fn normalize_provider(provider: &str) -> Result<&'static str, String> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai"),
        "anthropic" => Ok("anthropic"),
        "google" => Ok("google"),
        _ => Err("Unsupported provider.".to_string()),
    }
}

fn entry(provider: &str) -> Result<Entry, String> {
    let provider = normalize_provider(provider)?;
    Entry::new(SERVICE, provider).map_err(|error| error.to_string())
}

fn is_configured(provider: &'static str) -> Result<bool, String> {
    let entry = entry(provider)?;

    match entry.get_password() {
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

#[cfg(test)]
mod tests {
    use super::normalize_provider;

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
}
