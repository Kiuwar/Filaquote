use serde::Deserialize;
use serde_json::Value as JsonValue;
use sqlx::query::Query;
use sqlx::sqlite::{Sqlite, SqliteArguments};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<JsonValue>,
}

/// Mesma conversão de parâmetros do tauri-plugin-sql (números viram REAL; o SQLite
/// guarda inteiros em colunas INTEGER).
fn bind<'q>(
    query: Query<'q, Sqlite, SqliteArguments<'q>>,
    value: JsonValue,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    match value {
        JsonValue::Null => query.bind(None::<String>),
        JsonValue::String(s) => query.bind(s),
        JsonValue::Number(n) => query.bind(n.as_f64().unwrap_or_default()),
        JsonValue::Bool(b) => query.bind(b as i64),
        other => query.bind(other.to_string()),
    }
}

/// Executa várias instruções numa única transação, na mesma conexão do pool do
/// plugin. O plugin manda cada comando para uma conexão qualquer do pool, então
/// BEGIN/COMMIT enviados separadamente não seriam atômicos.
#[tauri::command]
pub async fn sql_batch(
    db: String,
    statements: Vec<Statement>,
    instances: State<'_, DbInstances>,
) -> Result<(), String> {
    let instances = instances.0.read().await;
    let pool = match instances.get(&db) {
        Some(DbPool::Sqlite(pool)) => pool,
        _ => return Err("Banco de dados não está aberto.".into()),
    };
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.params {
            query = bind(query, value);
        }
        query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}
