mod files;
mod window;

use tauri_plugin_sql::{Migration, MigrationKind};

/// Banco local. O mesmo nome é usado em src/platform/storage.ts (`DB_URL`).
/// O arquivo fica na pasta de configuração do app do usuário do sistema
/// (no Windows, dentro de %APPDATA%), então cada conta tem os próprios dados.
const DB_URL: &str = "sqlite:filaquote.db";

/// Migrações em ordem. Nunca altere uma migração já publicada: crie a próxima.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "settings",
            sql: include_str!("../migrations/0001_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "perfis",
            sql: include_str!("../migrations/0002_perfis.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "clientes_orcamentos",
            sql: include_str!("../migrations/0003_clientes_orcamentos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "pecas_recorrentes",
            sql: include_str!("../migrations/0004_pecas_recorrentes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "fechamentos",
            sql: include_str!("../migrations/0005_fechamentos.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![files::save_file])
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
