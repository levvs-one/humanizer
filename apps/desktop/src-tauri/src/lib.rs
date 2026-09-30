mod credentials;
mod runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(runtime::RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            credentials::set_provider_api_key,
            credentials::delete_provider_api_key,
            credentials::provider_credential_status,
            credentials::verify_provider_api_key,
            runtime::execute_provider_prompt,
            runtime::count_provider_tokens,
            runtime::stream_provider_prompt,
            runtime::cancel_provider_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running Humanizer");
}
