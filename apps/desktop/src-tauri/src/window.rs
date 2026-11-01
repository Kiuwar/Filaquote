use std::time::Duration;

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

/// Como a moldura é desenhada. Espelha `FrameMode` em src/platform/tauri.ts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FrameMode {
    /// Windows 11: sem moldura padrão, com `shadow(true)`. Segundo a documentação do
    /// Tauri, isso dá cantos arredondados e sombra do próprio sistema no Windows 11.
    #[cfg_attr(not(windows), allow(dead_code))]
    Native,
    /// Windows 10 (e demais sistemas por enquanto): janela transparente; a interface
    /// desenha cantos arredondados, sombra e alças de redimensionamento.
    Css,
}

impl FrameMode {
    fn as_str(self) -> &'static str {
        match self {
            FrameMode::Native => "native",
            FrameMode::Css => "css",
        }
    }
}

#[cfg(windows)]
fn detect_frame_mode() -> FrameMode {
    use windows_version::OsVersion;
    // O Windows 11 ainda se identifica como 10.0; a diferença é o build (22000+).
    if OsVersion::current() >= OsVersion::new(10, 0, 0, 22000) {
        FrameMode::Native
    } else {
        FrameMode::Css
    }
}

#[cfg(not(windows))]
fn detect_frame_mode() -> FrameMode {
    FrameMode::Css
}

pub fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    let mode = detect_frame_mode();

    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Filaquote")
        .inner_size(1240.0, 820.0)
        .min_inner_size(980.0, 660.0)
        .center()
        .decorations(false)
        // Nasce oculta; a interface chama show() depois do primeiro desenho.
        .visible(false)
        .initialization_script(format!(
            "window.__FILAQUOTE_FRAME__ = \"{}\";",
            mode.as_str()
        ));

    let builder = match mode {
        FrameMode::Native => builder.shadow(true),
        FrameMode::Css => builder.transparent(true).shadow(false),
    };

    let window = builder.build()?;

    // Se a interface falhar antes de chamar show(), a janela aparece mesmo assim.
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));
        let _ = window.show();
    });

    Ok(())
}
