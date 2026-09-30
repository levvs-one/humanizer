mod credentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            credentials::set_provider_api_key,
            credentials::delete_provider_api_key,
            credentials::provider_credential_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Humanizer");
}
