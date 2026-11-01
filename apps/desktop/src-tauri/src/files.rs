use std::path::Path;

/// Extensões que o app grava: PDF do orçamento e backup em JSON.
const ALLOWED: [&str; 2] = ["pdf", "json"];

/// Grava um arquivo no caminho que o usuário escolheu na janela "Salvar como".
/// Só aceita caminho absoluto e as extensões do app; nada é enviado para fora.
#[tauri::command]
pub fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.is_absolute() {
        return Err("Caminho inválido.".into());
    }
    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    if !ext.is_some_and(|e| ALLOWED.contains(&e.as_str())) {
        return Err("Só é possível salvar arquivos .pdf ou .json.".into());
    }
    std::fs::write(target, contents).map_err(|e| format!("Não foi possível salvar: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recusa_caminho_relativo_e_extensao_estranha() {
        assert!(save_file("relativo.pdf".into(), vec![]).is_err());
        let exe = std::env::temp_dir().join("filaquote-teste.exe");
        assert!(save_file(exe.to_string_lossy().into(), vec![]).is_err());
    }

    #[test]
    fn grava_pdf_no_caminho_escolhido() {
        let pdf = std::env::temp_dir().join("filaquote-teste.PDF");
        save_file(pdf.to_string_lossy().into(), b"%PDF-".to_vec()).unwrap();
        assert_eq!(std::fs::read(&pdf).unwrap(), b"%PDF-");
        let _ = std::fs::remove_file(pdf);
    }
}
