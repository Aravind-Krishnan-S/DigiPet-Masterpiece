use tauri::Manager;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use serde::Deserialize;

#[cfg(windows)]
use windows_sys::Win32::Foundation::POINT;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[derive(Clone, Deserialize)]
pub struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

lazy_static::lazy_static! {
    static ref OPAQUE_RECTS: Arc<Mutex<Vec<Rect>>> = Arc::new(Mutex::new(Vec::new()));
}

#[tauri::command]
fn update_opaque_rects(rects: Vec<Rect>) {
    if let Ok(mut lock) = OPAQUE_RECTS.lock() {
        *lock = rects;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![update_opaque_rects])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let app_handle = app.handle().clone();
      
      thread::spawn(move || {
          let mut was_ignoring = false;
          
          loop {
              thread::sleep(Duration::from_millis(16));
              
              #[cfg(windows)]
              let (mx, my) = {
                  let mut pt = POINT { x: 0, y: 0 };
                  unsafe { GetCursorPos(&mut pt) };
                  (pt.x as f64, pt.y as f64)
              };

              #[cfg(not(windows))]
              let (mx, my) = (0.0, 0.0);
              
              let mut should_ignore = true;
              if let Ok(rects) = OPAQUE_RECTS.lock() {
                  for r in rects.iter() {
                      if mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height {
                          should_ignore = false;
                          break;
                      }
                  }
              }
              
              if should_ignore != was_ignoring {
                  if let Some(window) = app_handle.get_webview_window("main") {
                      let _ = window.set_ignore_cursor_events(should_ignore);
                  }
                  was_ignoring = should_ignore;
              }
          }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
