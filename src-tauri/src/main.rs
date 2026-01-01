#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::Manager;
use std::path::Path;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ExamRecord {
    id: String,
    subject: String,
    task_type: String,
    solved: u32,
    correct: u32,
}

// Структура для тепловой карты
#[derive(serde::Serialize)]
struct ActivityPoint {
    date: String,
    count: u32, // Общее количество решенных задач за день
}

fn get_zenplan_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app.path().document_dir().expect("No docs dir");
    path.push("ZenPlan");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

// --- MD ЗАМЕТКИ ---
#[tauri::command]
fn save_note(app: tauri::AppHandle, date: String, content: String) -> Result<(), String> {
    let mut path = get_zenplan_dir(&app);
    path.push(format!("{}.md", date));
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_note(app: tauri::AppHandle, date: String) -> Result<String, String> {
    let mut path = get_zenplan_dir(&app);
    path.push(format!("{}.md", date));
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

// --- СТАТИСТИКА И АКТИВНОСТЬ ---

#[tauri::command]
fn save_stats(app: tauri::AppHandle, date: String, records: Vec<ExamRecord>) -> Result<(), String> {
    let mut path = get_zenplan_dir(&app);
    path.push(format!("{}.json", date));
    let json = serde_json::to_string_pretty(&records).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_stats(app: tauri::AppHandle, date: String) -> Result<Vec<ExamRecord>, String> {
    let mut path = get_zenplan_dir(&app);
    path.push(format!("{}.json", date));
    if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let records: Vec<ExamRecord> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(records)
    } else {
        Ok(Vec::new())
    }
}

// НОВАЯ ФУНКЦИЯ: Сканирует папку и считает активность
#[tauri::command]
fn get_activity_log(app: tauri::AppHandle) -> Result<Vec<ActivityPoint>, String> {
    let dir = get_zenplan_dir(&app);
    let mut activity_log = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // Проверяем, что это JSON файл
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                // Извлекаем дату из имени файла (2025-10-19.json -> 2025-10-19)
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let date_str = file_stem.to_string();

                    // Читаем файл и суммируем solved
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(records) = serde_json::from_str::<Vec<ExamRecord>>(&content) {
                            let total_solved: u32 = records.iter().map(|r| r.solved).sum();
                            if total_solved > 0 {
                                activity_log.push(ActivityPoint {
                                    date: date_str,
                                    count: total_solved
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(activity_log)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_note, load_note, save_stats, load_stats, get_activity_log])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}