import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";

// --- ТИПЫ ---
type ExamRecord = {
    id: string;
    subject: string;
    task_type: string;
    solved: number;
    correct: number;
};

type ActivityPoint = {
    date: string;
    count: number;
};

type Mode = "editor" | "stats";

function App() {
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [activeTab, setActiveTab] = useState<Mode>("stats");

    // --- State: Data ---
    const [noteContent, setNoteContent] = useState("");
    const [noteMode, setNoteMode] = useState<"edit" | "view">("edit");
    const [records, setRecords] = useState<ExamRecord[]>([]);
    const [activityLog, setActivityLog] = useState<ActivityPoint[]>([]);

    // --- State: Inputs ---
    const [newSubject, setNewSubject] = useState("Физика");
    const [newTaskType, setNewTaskType] = useState("№ 1");
    const [newSolved, setNewSolved] = useState(0);
    const [newCorrect, setNewCorrect] = useState(0);

    // --- State: Timer ---
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [customTime, setCustomTime] = useState("25");
    const [isEditingTimer, setIsEditingTimer] = useState(false);

    // Загрузка данных дня
    useEffect(() => {
        loadData();
    }, [date]);

    // Загрузка общей активности (при старте и обновлении статистики)
    useEffect(() => {
        loadActivity();
    }, [records]); // Обновляем карту, когда добавляем новую запись

    async function loadData() {
        try {
            const text = await invoke<string>("load_note", { date });
            setNoteContent(text);
        } catch (e) { console.error(e); }

        try {
            const stats = await invoke<ExamRecord[]>("load_stats", { date });
            setRecords(stats);
        } catch (e) { console.error(e); }
    }

    async function loadActivity() {
        try {
            const log = await invoke<ActivityPoint[]>("get_activity_log");
            setActivityLog(log);
        } catch (e) { console.error(e); }
    }

    // --- Логика Таймера ---
    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        } else if (timeLeft === 0) setIsActive(false);
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const handleTimerSet = () => {
        const mins = parseInt(customTime);
        if (!isNaN(mins)) setTimeLeft(mins * 60);
        setIsEditingTimer(false);
        setIsActive(false);
    };

    // --- Логика Данных ---
    const addRecord = async () => {
        if (newSolved === 0) return;
        const newRecord: ExamRecord = {
            id: Date.now().toString(),
            subject: newSubject,
            task_type: newTaskType,
            solved: newSolved,
            correct: newCorrect,
        };
        const updated = [...records, newRecord];
        setRecords(updated);
        await invoke("save_stats", { date, records: updated });
        setNewSolved(0); setNewCorrect(0);
    };

    const removeRecord = async (id: string) => {
        const updated = records.filter(r => r.id !== id);
        setRecords(updated);
        await invoke("save_stats", { date, records: updated });
    }

    const saveNote = async (content: string) => {
        setNoteContent(content);
        await invoke("save_note", { date, content });
    };

    // --- Подсчеты ---
    const totalSolved = records.reduce((acc, r) => acc + r.solved, 0);
    const totalCorrect = records.reduce((acc, r) => acc + r.correct, 0);
    const accuracy = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // --- Генерация GitHub Heatmap (последние 16 недель) ---
    const heatmapData = useMemo(() => {
        const weeks = 20; // Сколько недель показывать
        const today = new Date();
        const data = [];

        // Сдвигаем дату назад
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (weeks * 7));
        // Выравниваем на понедельник (опционально, GitHub начинает с Вс, но нам удобнее Пн)
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        // Генерируем даты
        for (let i = 0; i < weeks * 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            // Ищем активность
            const activity = activityLog.find(a => a.date === dateStr);
            const count = activity ? activity.count : 0;

            // Цвет (Purple Theme)
            let colorClass = "bg-[#2f3136]"; // 0
            if (count > 0) colorClass = "bg-[#581c87]"; // Немного (1-5)
            if (count > 5) colorClass = "bg-[#7e22ce]"; // Норм (5-15)
            if (count > 15) colorClass = "bg-[#a855f7]"; // Отлично (15-30)
            if (count > 30) colorClass = "bg-[#d8b4fe] shadow-[0_0_10px_#d8b4fe]"; // Монстр (30+)

            data.push({ date: dateStr, count, colorClass });
        }
        return data;
    }, [activityLog]);


    return (
        <div className="flex h-screen bg-[#1e1e1e] text-[#dcddde] font-sans selection:bg-purple-500 selection:text-white">

            {/* SIDEBAR */}
            <div className="w-72 bg-[#2f3136] p-6 flex flex-col border-r border-[#1e1f22]">
                <h1 className="text-2xl font-bold mb-6 text-purple-400 tracking-tight">ZenPlan</h1>

                <div className="mb-6">
                    <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">Дата</label>
                    <input
                        type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="w-full mt-2 bg-[#202225] text-white p-3 rounded-lg border border-[#1e1f22] outline-none focus:border-purple-500 transition-colors"
                    />
                </div>

                {/* Timer */}
                <div className="bg-[#202225] p-5 rounded-xl border border-[#1e1f22] text-center shadow-lg mb-6">
                    {isEditingTimer ? (
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <input
                                autoFocus
                                className="w-16 bg-[#2f3136] text-white text-center p-1 rounded border border-gray-600"
                                value={customTime}
                                onChange={(e) => setCustomTime(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTimerSet()}
                            />
                            <button onClick={handleTimerSet} className="text-green-400 text-xs font-bold">OK</button>
                        </div>
                    ) : (
                        <div
                            onClick={() => setIsEditingTimer(true)}
                            className="text-5xl font-mono mb-4 cursor-pointer hover:text-purple-300 transition-colors select-none"
                        >
                            {formatTime(timeLeft)}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={`py-2 rounded-lg text-sm font-bold ${isActive ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/50'} hover:brightness-110 transition`}
                        >
                            {isActive ? "PAUSE" : "START"}
                        </button>
                        <button
                            onClick={() => { setIsActive(false); setTimeLeft(parseInt(customTime)*60); }}
                            className="py-2 rounded-lg text-sm font-bold bg-gray-600/20 text-gray-400 border border-gray-600/50 hover:bg-gray-600/40 transition"
                        >
                            RESET
                        </button>
                    </div>
                </div>

                {/* Daily Stats Mini */}
                <div className="mt-auto">
                    <div className="text-xs uppercase font-bold text-gray-500 mb-2">Статистика за {date}</div>
                    <div className="bg-[#202225] p-3 rounded-lg border border-[#1e1f22]">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Решено:</span> <span className="text-white font-mono">{totalSolved}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span>Точность:</span> <span className={`${accuracy >= 70 ? 'text-green-400' : accuracy >= 40 ? 'text-yellow-400' : 'text-red-400'} font-mono`}>{accuracy}%</span>
                        </div>
                        <div className="w-full bg-[#2f3136] h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 transition-all duration-500" style={{width: `${accuracy}%`}}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">

                {/* Tabs */}
                <div className="h-16 flex items-center px-8 border-b border-[#2f3136] gap-6 shrink-0">
                    <button onClick={() => setActiveTab("stats")} className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'stats' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>📊 EXAM TRACKER</button>
                    <button onClick={() => setActiveTab("editor")} className={`pb-4 pt-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'editor' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>📝 DAILY NOTES</button>
                </div>

                {/* STATS VIEW */}
                {activeTab === "stats" && (
                    <div className="flex-1 overflow-y-auto p-8">

                        {/* Input Form */}
                        <div className="bg-[#2f3136] p-6 rounded-xl border border-[#1e1f22] mb-8 shadow-sm">
                            <h3 className="text-lg font-semibold text-white mb-4">Добавить результат</h3>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div className="md:col-span-1">
                                    <label className="block text-xs text-gray-400 mb-1">Предмет</label>
                                    <select value={newSubject} onChange={e => setNewSubject(e.target.value)} className="w-full bg-[#202225] border border-[#1e1f22] text-white rounded p-2 text-sm outline-none focus:border-purple-500">
                                        <option>Физика</option> <option>Математика</option> <option>Информатика</option> <option>Русский язык</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs text-gray-400 mb-1">Тип задания</label>
                                    <input type="text" value={newTaskType} onChange={e => setNewTaskType(e.target.value)} className="w-full bg-[#202225] border border-[#1e1f22] text-white rounded p-2 text-sm outline-none focus:border-purple-500" placeholder="№ 12"/>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs text-gray-400 mb-1">Решено</label>
                                    <input type="number" value={newSolved} onChange={e => setNewSolved(parseInt(e.target.value) || 0)} className="w-full bg-[#202225] border border-[#1e1f22] text-white rounded p-2 text-sm outline-none focus:border-purple-500"/>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs text-gray-400 mb-1">Верно</label>
                                    <input type="number" value={newCorrect} onChange={e => setNewCorrect(parseInt(e.target.value) || 0)} className="w-full bg-[#202225] border border-[#1e1f22] text-white rounded p-2 text-sm outline-none focus:border-purple-500"/>
                                </div>
                                <div className="md:col-span-1">
                                    <button onClick={addRecord} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition shadow-lg">Добавить</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                            {/* History List */}
                            <div className="lg:col-span-2 space-y-3">
                                <h3 className="text-sm uppercase font-bold text-gray-500">История за {date}</h3>
                                {records.length === 0 && <div className="text-gray-600 italic text-sm">Пока нет записей...</div>}
                                {[...records].reverse().map(rec => (
                                    <div key={rec.id} className="bg-[#2f3136] p-3 rounded-lg border border-[#1e1f22] flex items-center justify-between group hover:border-gray-600 transition">
                                        <div>
                                            <span className="text-purple-400 font-bold text-sm mr-3">{rec.subject}</span>
                                            <span className="text-white font-medium text-sm mr-3">{rec.task_type}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm text-gray-400"><span className="text-white">{rec.correct}</span> / {rec.solved}</div>
                                            <div className="w-20 h-1.5 bg-[#202225] rounded-full overflow-hidden">
                                                <div className={`h-full ${rec.correct/rec.solved >= 0.7 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{width: `${(rec.correct/rec.solved)*100}%`}}/>
                                            </div>
                                            <button onClick={() => removeRecord(rec.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Subject Summary */}
                            <div className="space-y-3">
                                <h3 className="text-sm uppercase font-bold text-gray-500">По предметам</h3>
                                {Array.from(new Set(records.map(r => r.subject))).map(subj => {
                                    const subjRecords = records.filter(r => r.subject === subj);
                                    const sSolved = subjRecords.reduce((a, b) => a + b.solved, 0);
                                    const sCorrect = subjRecords.reduce((a, b) => a + b.correct, 0);
                                    const sAcc = sSolved > 0 ? Math.round((sCorrect/sSolved)*100) : 0;
                                    return (
                                        <div key={subj} className="bg-[#2f3136] p-3 rounded-lg border border-[#1e1f22]">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-gray-200 text-sm">{subj}</span>
                                                <span className="text-gray-400 text-xs">{sCorrect}/{sSolved}</span>
                                            </div>
                                            <div className="w-full bg-[#202225] h-1.5 rounded-full overflow-hidden mb-1">
                                                <div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${sAcc}%`}}/>
                                            </div>
                                            <div className="text-right text-[10px] text-blue-400">{sAcc}%</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* --- ACTIVITY HEATMAP (GitHub Style) --- */}
                        <div className="mt-8">
                            <h3 className="text-sm uppercase font-bold text-gray-500 mb-4">Активность (решенные задачи)</h3>
                            <div className="bg-[#202225] p-6 rounded-xl border border-[#1e1f22] overflow-x-auto">
                                <div className="flex gap-1 min-w-max">
                                    {/* Render columns (weeks) */}
                                    {Array.from({ length: 20 }).map((_, weekIndex) => (
                                        <div key={weekIndex} className="flex flex-col gap-1">
                                            {Array.from({ length: 7 }).map((_, dayIndex) => {
                                                const dataIndex = weekIndex * 7 + dayIndex;
                                                const item = heatmapData[dataIndex];
                                                if (!item) return null;
                                                return (
                                                    <div
                                                        key={item.date}
                                                        className={`w-3 h-3 rounded-sm ${item.colorClass} transition-all duration-300 hover:scale-125 cursor-pointer`}
                                                        title={`${item.date}: ${item.count} задач`}
                                                        onClick={() => setDate(item.date)}
                                                    />
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end items-center gap-2 mt-2 text-[10px] text-gray-500">
                                    <span>Maudit</span>
                                    <div className="w-3 h-3 bg-[#2f3136] rounded-sm"></div>
                                    <div className="w-3 h-3 bg-[#581c87] rounded-sm"></div>
                                    <div className="w-3 h-3 bg-[#7e22ce] rounded-sm"></div>
                                    <div className="w-3 h-3 bg-[#a855f7] rounded-sm"></div>
                                    <div className="w-3 h-3 bg-[#d8b4fe] rounded-sm"></div>
                                    <span>God Mode</span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* EDITOR VIEW */}
                {activeTab === "editor" && (
                    <div className="flex-1 flex flex-col relative">
                        <div className="absolute top-4 right-8 z-10 flex bg-[#2f3136] rounded p-1 border border-[#1e1f22]">
                            <button onClick={() => setNoteMode("edit")} className={`px-3 py-1 text-xs font-bold rounded ${noteMode==='edit' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>EDIT</button>
                            <button onClick={() => setNoteMode("view")} className={`px-3 py-1 text-xs font-bold rounded ${noteMode==='view' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>VIEW</button>
                        </div>
                        {noteMode === "edit" ? (
                            <textarea
                                className="w-full h-full bg-[#1e1e1e] p-8 text-lg outline-none resize-none font-mono text-gray-300 leading-relaxed"
                                value={noteContent} onChange={(e) => saveNote(e.target.value)}
                                placeholder="# План подготовки..."
                            />
                        ) : (
                            <div className="prose prose-invert max-w-none p-8 overflow-y-auto"><ReactMarkdown>{noteContent}</ReactMarkdown></div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;