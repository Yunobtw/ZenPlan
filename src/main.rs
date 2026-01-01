use eframe::egui;

// Структура одной записи (как на скриншоте)
#[derive(Clone)]
struct StudyEntry {
    date: String,
    subject: String,
    task_type: String,
    solved: u32,
    correct: u32,
}

struct StudyTrackerApp {
    // Список всех записей
    entries: Vec<StudyEntry>,
    
    // Поля для ввода (буферы)
    input_date: String,
    input_subject: String,
    input_type: String,
    input_solved: u32,
    input_correct: u32,
}

impl Default for StudyTrackerApp {
    fn default() -> Self {
        Self {
            entries: vec![],
            // Ставим сегодняшнюю дату
            input_date: chrono::Local::now().format("%d.%m.%Y").to_string(),
            input_subject: "Информатика".to_owned(),
            input_type: "Тип 1".to_owned(),
            input_solved: 0,
            input_correct: 0,
        }
    }
}

impl eframe::App for StudyTrackerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // --- Настройка шрифтов для Кириллицы (нужен файл шрифта!) ---
        // Если у вас нет .ttf файла, русский текст может отображаться некорректно.
        // Для теста можно пока писать на английском.
        
        egui::CentralPanel::default().show(ctx, |ui| {
            // Глобальный стиль (темная тема)
            ctx.set_visuals(egui::Visuals::dark());

            // 1. ВЕРХНЯЯ ПАНЕЛЬ (Ввод данных)
            egui::Frame::group(ui.style()).show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label("Дата");
                        ui.text_edit_singleline(&mut self.input_date);
                    });
                    
                    ui.vertical(|ui| {
                        ui.label("Предмет");
                        egui::ComboBox::from_id_source("subj_combo")
                            .selected_text(&self.input_subject)
                            .show_ui(ui, |ui| {
                                ui.selectable_value(&mut self.input_subject, "Информатика".to_string(), "Информатика");
                                ui.selectable_value(&mut self.input_subject, "Математика".to_string(), "Математика");
                                ui.selectable_value(&mut self.input_subject, "Физика".to_string(), "Физика");
                            });
                    });

                    ui.vertical(|ui| {
                        ui.label("Тип задания");
                        egui::ComboBox::from_id_source("type_combo")
                            .selected_text(&self.input_type)
                            .show_ui(ui, |ui| {
                                ui.selectable_value(&mut self.input_type, "Тип 1".to_string(), "Тип 1");
                                ui.selectable_value(&mut self.input_type, "Тип 13".to_string(), "Тип 13");
                                ui.selectable_value(&mut self.input_type, "Тип 24".to_string(), "Тип 24");
                            });
                    });

                    ui.vertical(|ui| {
                        ui.label("Решено");
                        ui.add(egui::DragValue::new(&mut self.input_solved));
                    });

                    ui.vertical(|ui| {
                        ui.label("Верно");
                        ui.add(egui::DragValue::new(&mut self.input_correct));
                    });

                    ui.add_space(10.0);
                    // Кнопка "Добавить" - Зеленая
                    let btn = egui::Button::new("Добавить").fill(egui::Color32::from_rgb(0, 150, 100));
                    if ui.add_sized([80.0, 30.0], btn).clicked() {
                        self.entries.push(StudyEntry {
                            date: self.input_date.clone(),
                            subject: self.input_subject.clone(),
                            task_type: self.input_type.clone(),
                            solved: self.input_solved,
                            correct: self.input_correct,
                        });
                    }
                });
            });

            ui.add_space(20.0);

            // 2. РАЗДЕЛЕНИЕ ЭКРАНА (Список и Статистика)
            ui.columns(2, |columns| {
                
                // --- ЛЕВАЯ КОЛОНКА: СПИСОК "СЕГОДНЯ" ---
                columns[0].vertical(|ui| {
                    ui.heading(format!("Сегодня · {}", self.input_date));
                    ui.separator();
                    
                    for (idx, entry) in self.entries.iter().enumerate() {
                        // Отрисовка карточки задания
                        ui.group(|ui| {
                            ui.horizontal(|ui| {
                                ui.label(egui::RichText::new(format!("№ {}", idx + 1)).strong().size(16.0));
                                ui.label(format!("{} | {}", entry.subject, entry.task_type));
                                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                    ui.label(format!("Верно: {}", entry.correct));
                                    ui.label(format!("Решено: {}", entry.solved));
                                });
                            });
                        });
                        ui.add_space(5.0);
                    }
                });

                // --- ПРАВАЯ КОЛОНКА: СТАТИСТИКА ---
                columns[1].vertical(|ui| {
                    ui.heading("Информатика");
                    ui.separator();
                    
                    ui.label("Всего");
                    let progress = 0.83; 
                    ui.add(egui::ProgressBar::new(progress).text("83% · 33/40").animate(true));
                    
                    ui.add_space(10.0);
                    ui.label("За неделю");
                    ui.add(egui::ProgressBar::new(0.60).text("60% · 20/33"));

                    ui.add_space(20.0);
                    ui.label("По типам:");
                    
                    ui.label("Тип 1");
                    ui.add(egui::ProgressBar::new(0.75).text("75% · 15/20"));
                    
                    ui.label("Тип 13");
                    ui.add(egui::ProgressBar::new(0.90).text("90% · 18/20"));
                });
            });
            
            // Место для Heatmap (зеленые квадратики) можно добавить ниже
            ui.add_space(30.0);
            ui.separator();
            ui.heading("Активность (Github Style)");
            // Тут код отрисовки квадратиков из предыдущего ответа
        });
    }
}

fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "Study Tracker",
        options,
        Box::new(|_cc| Box::new(StudyTrackerApp::default())),
    )
}