mod window;

use tauri_plugin_sql::{Migration, MigrationKind};

/// Banco local. O mesmo nome é usado em src/platform/storage.ts (`DB_URL`).
/// O arquivo fica na pasta de configuração do app do usuário do sistema
/// (no Windows, dentro de %APPDATA%), então cada conta tem os próprios dados.
const DB_URL: &str = "sqlite:filaquote.db";

/// Migrações em ordem. Nunca altere uma migração já publicada: crie a próxima.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "settings",
        sql: include_str!("../migrations/0001_settings.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .setup(|app| {
            window::create_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Filaquote");
}
