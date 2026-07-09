import { useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = {
  sprints: "stm_sprints",
  tasks: "stm_tasks",
  workAreas: "stm_workAreas",
  categories: "stm_categories",
};

const DEFAULT_WORK_AREAS = [
  { id: "wcm-desktop", name: "WCM Desktop", color: "#2563eb" },
  { id: "mobile", name: "Mobile", color: "#7c3aed" },
  { id: "cursor", name: "Cursor", color: "#16a34a" },
];

const DEFAULT_CATEGORIES = [
  "בדיקות",
  "פיתוח אוטומציה",
  "תיעוד",
  "חקירה",
  "פגישה",
  "תמיכה",
  "באגים",
  "אחר",
];

const STATUSES = ["בוצע", "בתהליך", "חסום", "דורש המשך טיפול"];
const PRIORITIES = ["רגילה", "גבוהה", "דחופה"];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultSprint(name = "Sprint נוכחי") {
  const startDate = getToday();
  return {
    id: uid(),
    name,
    startDate,
    endDate: addDays(startDate, 13),
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("he-IL").format(new Date(dateString));
}

function groupByDate(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.date] = acc[task.date] || [];
    acc[task.date].push(task);
    return acc;
  }, {});
}

function getDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function getWeekday(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(dateString));
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [workAreas, setWorkAreas] = useState(DEFAULT_WORK_AREAS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [filters, setFilters] = useState({ workAreaId: "all", status: "all" });
  const [newWorkArea, setNewWorkArea] = useState({ name: "", color: "#2563eb" });
  const [newCategory, setNewCategory] = useState("");

  const initialForm = {
    date: getToday(),
    expectedEndDate: "",
    workAreaId: "wcm-desktop",
    title: "",
    description: "",
    category: "בדיקות",
    status: "בוצע",
    priority: "רגילה",
    notes: "",
  };

  const [form, setForm] = useState(initialForm);
  const [sprintForm, setSprintForm] = useState({
    name: "",
    startDate: getToday(),
    endDate: addDays(getToday(), 13),
  });

  useEffect(() => {
    const savedSprints = readStorage(STORAGE_KEYS.sprints, []);
    const savedTasks = readStorage(STORAGE_KEYS.tasks, []);
    const savedWorkAreas = readStorage(STORAGE_KEYS.workAreas, DEFAULT_WORK_AREAS);
    const savedCategories = readStorage(STORAGE_KEYS.categories, DEFAULT_CATEGORIES);

    if (savedSprints.length === 0) {
      const firstSprint = createDefaultSprint();
      setSprints([firstSprint]);
      saveStorage(STORAGE_KEYS.sprints, [firstSprint]);
    } else {
      setSprints(savedSprints);
    }

    setTasks(savedTasks);
    setWorkAreas(savedWorkAreas);
    setCategories(savedCategories);
  }, []);

  useEffect(() => saveStorage(STORAGE_KEYS.sprints, sprints), [sprints]);
  useEffect(() => saveStorage(STORAGE_KEYS.tasks, tasks), [tasks]);
  useEffect(() => saveStorage(STORAGE_KEYS.workAreas, workAreas), [workAreas]);
  useEffect(() => saveStorage(STORAGE_KEYS.categories, categories), [categories]);

  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === "active"),
    [sprints]
  );

  const activeSprintTasks = useMemo(
    () => tasks.filter((task) => task.sprintId === activeSprint?.id),
    [tasks, activeSprint]
  );

  const sprintDays = useMemo(() => {
    if (!activeSprint) return [];
    const tasksByDate = groupByDate(activeSprintTasks);

    return getDateRange(activeSprint.startDate, activeSprint.endDate).map((date) => ({
      date,
      tasks: (tasksByDate[date] || []).slice().sort((a, b) => a.createdAt?.localeCompare(b.createdAt || "") || 0),
    }));
  }, [activeSprint, activeSprintTasks]);

  const daysWithTasks = sprintDays.filter((day) => day.tasks.length > 0).length;

  const filteredTasks = useMemo(() => {
    return activeSprintTasks.filter((task) => {
      const areaMatch = filters.workAreaId === "all" || task.workAreaId === filters.workAreaId;
      const statusMatch = filters.status === "all" || task.status === filters.status;
      return areaMatch && statusMatch;
    });
  }, [activeSprintTasks, filters]);

  const getWorkArea = (id) => workAreas.find((area) => area.id === id);

  const summary = useMemo(() => {
    const done = activeSprintTasks.filter((task) => task.status === "בוצע").length;
    const open = activeSprintTasks.length - done;
    const byWorkArea = workAreas.map((area) => ({
      ...area,
      count: activeSprintTasks.filter((task) => task.workAreaId === area.id).length,
    }));
    const byCategory = categories.map((category) => ({
      name: category,
      count: activeSprintTasks.filter((task) => task.category === category).length,
    }));
    return { done, open, byWorkArea, byCategory };
  }, [activeSprintTasks, workAreas, categories]);

  const sprintText = useMemo(() => {
    const dayLines = sprintDays
      .map((day) => {
        if (day.tasks.length === 0) {
          return `${formatDate(day.date)} - אין משימות`;
        }

        const lines = day.tasks.map((task) => {
          const area = getWorkArea(task.workAreaId)?.name || "ללא תחום";
          const expected = task.expectedEndDate ? `, צפי סיום: ${formatDate(task.expectedEndDate)}` : "";
          return `  - ${task.title} (${area}, ${task.status}${expected})`;
        });
        return `${formatDate(day.date)}\n${lines.join("\n")}`;
      })
      .join("\n\n");

    const areaLines = summary.byWorkArea
      .filter((area) => area.count > 0)
      .map((area) => `- ${area.name}: ${area.count} משימות`)
      .join("\n");

    return `סיכום ${activeSprint?.name || "ספרינט"}\n${formatDate(activeSprint?.startDate)} - ${formatDate(activeSprint?.endDate)}\n\nסה״כ משימות: ${activeSprintTasks.length}\nבוצעו: ${summary.done}\nדורשות המשך / פתוחות: ${summary.open}\n\nחלוקה לפי תחומי עבודה:\n${areaLines || "אין משימות עדיין"}\n\nפירוט לפי ימים:\n${dayLines || "אין משימות עדיין"}`;
  }, [activeSprint, activeSprintTasks, summary, sprintDays]);

  function submitTask(event) {
    event.preventDefault();
    if (!activeSprint) return;
    if (!form.title.trim()) {
      alert("חובה להזין כותרת למשימה");
      return;
    }

    if (editingTaskId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingTaskId
            ? { ...task, ...form, updatedAt: new Date().toISOString() }
            : task
        )
      );
      setEditingTaskId(null);
    } else {
      setTasks((prev) => [
        {
          id: uid(),
          sprintId: activeSprint.id,
          ...form,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    setForm({ ...initialForm, workAreaId: form.workAreaId, date: form.date });
    setActiveTab("dashboard");
  }

  function editTask(task) {
    setEditingTaskId(task.id);
    setForm({
      date: task.date,
      expectedEndDate: task.expectedEndDate || "",
      workAreaId: task.workAreaId,
      title: task.title,
      description: task.description,
      category: task.category,
      status: task.status,
      priority: task.priority,
      notes: task.notes || "",
    });
    setActiveTab("tasks");
  }

  function deleteTask(taskId) {
    if (!confirm("למחוק את המשימה?")) return;
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  function openNewTaskForm() {
    setEditingTaskId(null);
    setForm({ ...initialForm, date: getToday(), expectedEndDate: "" });
    setActiveTab("tasks");
  }

  const recentTasks = activeSprintTasks.slice(0, 5);
  const todayTasks = activeSprintTasks.filter((task) => task.date === getToday());

  function createSprint(event) {
    event.preventDefault();
    if (!sprintForm.name.trim()) {
      alert("חובה להזין שם ספרינט");
      return;
    }

    const newSprint = {
      id: uid(),
      name: sprintForm.name.trim(),
      startDate: sprintForm.startDate,
      endDate: sprintForm.endDate,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    setSprints((prev) => [newSprint, ...prev.map((sprint) => ({ ...sprint, status: "closed" }))]);
    setSprintForm({ name: "", startDate: getToday(), endDate: addDays(getToday(), 13) });
    setActiveTab("dashboard");
  }

  function activateSprint(sprintId) {
    if (!confirm("להפוך את הספרינט הזה לפעיל? הספרינט הפעיל הנוכחי ייסגר.")) return;
    setSprints((prev) =>
      prev.map((sprint) => ({ ...sprint, status: sprint.id === sprintId ? "active" : "closed" }))
    );
    setActiveTab("dashboard");
  }

  function addWorkArea(event) {
    event.preventDefault();
    if (!newWorkArea.name.trim()) return;
    setWorkAreas((prev) => [
      ...prev,
      { id: uid(), name: newWorkArea.name.trim(), color: newWorkArea.color },
    ]);
    setNewWorkArea({ name: "", color: "#2563eb" });
  }

  function renameWorkArea(id, name) {
    setWorkAreas((prev) => prev.map((area) => (area.id === id ? { ...area, name } : area)));
  }

  function updateWorkAreaColor(id, color) {
    setWorkAreas((prev) => prev.map((area) => (area.id === id ? { ...area, color } : area)));
  }

  function removeWorkArea(id) {
    const hasTasks = tasks.some((task) => task.workAreaId === id);
    if (hasTasks) {
      alert("אי אפשר למחוק תחום עבודה שיש עליו משימות קיימות.");
      return;
    }
    setWorkAreas((prev) => prev.filter((area) => area.id !== id));
  }

  function addCategory(event) {
    event.preventDefault();
    const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    setCategories((prev) => [...prev, value]);
    setNewCategory("");
  }

  function copySummary() {
    navigator.clipboard.writeText(sprintText);
    alert("סיכום הספרינט הועתק");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">⏱</div>
          <div>
            <h1>ניהול זמן</h1>
            <p>Sprint Tracker</p>
          </div>
        </div>

        <nav className="nav">
          <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>דשבורד</button>
          <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>משימות יומיות</button>
          <button className={activeTab === "summary" ? "active" : ""} onClick={() => setActiveTab("summary")}>סיכום ספרינט</button>
          <button className={activeTab === "newSprint" ? "active" : ""} onClick={() => setActiveTab("newSprint")}>ספרינט חדש</button>
          <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>היסטוריה</button>
          <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>הגדרות</button>
        </nav>
      </aside>

      <main className="main">
        <header className="hero">
          <div>
            <span className="eyebrow">Sprint Time Manager</span>
            <h2>{activeSprint?.name || "אין ספרינט פעיל"}</h2>
            <p>{formatDate(activeSprint?.startDate)} עד {formatDate(activeSprint?.endDate)}</p>
          </div>

        </header>

        {activeTab === "dashboard" && (
          <section className="dashboard-page">
            <div className="dashboard-overview">
              <div className="overview-header">
                <div>
                  <span className="pill success">ספרינט פעיל</span>
                  <h3>תמונת מצב כללית</h3>
                  <p>כאן רואים במהירות את מצב הספרינט, המשימות האחרונות ומה נשאר להמשך.</p>
                </div>
              </div>

              <div className="metric-grid">
                <div className="metric-card blue">
                  <span>סה״כ משימות</span>
                  <strong>{activeSprintTasks.length}</strong>
                </div>
                <div className="metric-card green">
                  <span>בוצעו</span>
                  <strong>{summary.done}</strong>
                </div>
                <div className="metric-card orange">
                  <span>פתוחות / המשך</span>
                  <strong>{summary.open}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-content">
              <div className="dashboard-primary-column">
                <div className="dashboard-main-card accent-card tasks-accent">
                  <div className="card-title compact-title">
                    <div>
                      <span className="section-kicker">ספרינט נוכחי</span>
                      <h3>משימות אחרונות בספרינט</h3>
                      <p>לחיצה על משימה תפתח אותה לעריכה.</p>
                    </div>
                  </div>

                  {recentTasks.length === 0 ? (
                    <div className="empty large-empty">עדיין אין משימות בספרינט. הוסף משימה דרך הפעולות המהירות.</div>
                  ) : (
                    <div className="dashboard-task-list">
                      {recentTasks.map((task) => {
                        const area = getWorkArea(task.workAreaId);
                        return (
                          <button className="dashboard-task" key={task.id} onClick={() => editTask(task)}>
                            <span className="task-dot" style={{ backgroundColor: area?.color || "#2563eb" }} />
                            <span className="dashboard-task-main">
                              <strong>{task.title}</strong>
                              <small>{formatDate(task.date)} · {area?.name} · {task.category}{task.expectedEndDate ? ` · צפי: ${formatDate(task.expectedEndDate)}` : ""}</small>
                            </span>
                            <span className={`status status-${task.status.replaceAll(" ", "-")}`}>{task.status}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="dashboard-side-card accent-card days-accent">
                  <div className="card-title compact-title days-title-row">
                    <div>
                      <span className="section-kicker">ספרינט לפי ימים</span>
                      <h3>משימות לפי ימים בספרינט</h3>
                      <p>{daysWithTasks} ימים עם משימות מתוך {sprintDays.length} ימי ספרינט.</p>
                    </div>
                    <button className="ghost small" onClick={() => setActiveTab("summary")}>פירוט מלא</button>
                  </div>

                  <div className="sprint-days-strip">
                    {sprintDays.map((day) => (
                      <button
                        className={`day-summary-card ${day.tasks.length > 0 ? "has-tasks" : "is-empty"}`}
                        key={day.date}
                        onClick={() => setActiveTab("summary")}
                      >
                        <span className="day-date">{formatDate(day.date)}</span>
                        <strong>{day.tasks.length > 0 ? `${day.tasks.length} משימות` : "אין משימות"}</strong>
                        <span className="day-task-preview">
                          {day.tasks.length > 0
                            ? day.tasks.slice(0, 2).map((task) => task.title).join(" · ")
                            : "יום פנוי / ללא דיווח"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dashboard-secondary-column">
                <div className="dashboard-side-card quick-card">
                  <span className="section-kicker light-kicker">פעולות</span>
                  <h3>פעולות מהירות</h3>
                  <div className="quick-actions">
                    <button onClick={openNewTaskForm}>+ הוסף משימה</button>
                    <button onClick={() => setActiveTab("newSprint")}>+ ספרינט חדש</button>
                    <button onClick={() => setActiveTab("summary")}>צפה בסיכום</button>
                    <button onClick={copySummary}>העתק סיכום</button>
                  </div>
                </div>

                <div className="dashboard-side-card today-card accent-card today-accent">
                  <div className="card-title compact-title">
                    <div>
                      <span className="section-kicker">היום</span>
                      <h3>משימות היום</h3>
                    </div>
                  </div>
                  {todayTasks.length === 0 ? (
                    <div className="empty compact">אין עדיין משימות להיום.</div>
                  ) : (
                    <div className="mini-list">
                      {todayTasks.map((task) => (
                        <button className="mini-task" key={task.id} onClick={() => editTask(task)}>
                          <strong>{task.title}</strong>
                          <span>{getWorkArea(task.workAreaId)?.name} · {task.status}{task.expectedEndDate ? ` · צפי: ${formatDate(task.expectedEndDate)}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "tasks" && (
          <section className="page-grid tasks-layout">
            <div className="card form-card">
              <h3>{editingTaskId ? "עריכת משימה" : "הוספת משימה יומית"}</h3>
              <form onSubmit={submitTask} className="form">
                <div className="two-cols">
                  <label>תאריך<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                  <label>צפי סיום<input type="date" value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} /></label>
                </div>
                <label>על מה עבדתי היום?<select value={form.workAreaId} onChange={(e) => setForm({ ...form, workAreaId: e.target.value })}>{workAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
                <label>כותרת<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="לדוגמה: בדיקות Status Code ל-Ynet QA" /></label>
                <label>תיאור<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="מה עשית בפועל?" /></label>
                <div className="two-cols">
                  <label>סוג פעילות<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label>סטטוס<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                </div>
                <div className="two-cols">
                  <label>חשיבות<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                  <label>הערות<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="אופציונלי" /></label>
                </div>
                <button className="primary" type="submit">{editingTaskId ? "שמור שינוי" : "שמור משימה"}</button>
                {editingTaskId && <button className="ghost" type="button" onClick={() => { setEditingTaskId(null); setForm(initialForm); }}>ביטול עריכה</button>}
              </form>
            </div>

            <div className="card tasks-card">
              <div className="card-title">
                <h3>משימות בספרינט</h3>
                <div className="filters">
                  <select value={filters.workAreaId} onChange={(e) => setFilters({ ...filters, workAreaId: e.target.value })}>
                    <option value="all">כל התחומים</option>
                    {workAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="all">כל הסטטוסים</option>
                    {STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              {filteredTasks.length === 0 ? <div className="empty">אין משימות להצגה.</div> : (
                <div className="task-list">
                  {filteredTasks.map((task) => {
                    const area = getWorkArea(task.workAreaId);
                    return (
                      <article className="task" key={task.id}>
                        <div className="task-top">
                          <div>
                            <h4>{task.title}</h4>
                            <div className="meta"><span>{formatDate(task.date)}</span><span>•</span><span>{area?.name}</span><span>•</span><span>{task.category}</span>{task.expectedEndDate && <><span>•</span><span>צפי סיום: {formatDate(task.expectedEndDate)}</span></>}</div>
                          </div>
                          <span className={`status status-${task.status.replaceAll(" ", "-")}`}>{task.status}</span>
                        </div>
                        {task.description && <p>{task.description}</p>}
                        {task.notes && <small>הערות: {task.notes}</small>}
                        <div className="task-actions"><button onClick={() => editTask(task)}>ערוך</button><button className="danger" onClick={() => deleteTask(task.id)}>מחק</button></div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "summary" && (
          <section className="summary-page">
            <div className="summary-hero-card">
              <div>
                <span className="section-kicker">מוכן להעתקה</span>
                <h3>סיכום ספרינט מעוצב</h3>
                <p>תצוגה נקייה לפגישת סטטוס, עם כפתור העתקה ששומר טקסט פשוט ונוח להדבקה.</p>
              </div>
              <button className="primary" onClick={copySummary}>העתק סיכום</button>
            </div>

            <div className="summary-grid">
              <article className="summary-preview-card">
                <div className="summary-preview-header">
                  <div>
                    <span>סיכום</span>
                    <h3>{activeSprint?.name || "ספרינט"}</h3>
                    <p>{formatDate(activeSprint?.startDate)} - {formatDate(activeSprint?.endDate)}</p>
                  </div>
                  <span className="pill success">{summary.done} בוצעו</span>
                </div>

                <div className="summary-stat-row">
                  <div><strong>{activeSprintTasks.length}</strong><span>סה״כ משימות</span></div>
                  <div><strong>{summary.done}</strong><span>בוצעו</span></div>
                  <div><strong>{summary.open}</strong><span>פתוחות / המשך</span></div>
                  <div><strong>{daysWithTasks}</strong><span>ימים עם פעילות</span></div>
                </div>

                <div className="summary-section">
                  <h4>חלוקה לפי תחומי עבודה</h4>
                  <div className="summary-chips">
                    {summary.byWorkArea.filter((area) => area.count > 0).length === 0 ? (
                      <span>אין משימות עדיין</span>
                    ) : (
                      summary.byWorkArea.filter((area) => area.count > 0).map((area) => (
                        <span key={area.id}><i style={{ backgroundColor: area.color }} />{area.name}: {area.count}</span>
                      ))
                    )}
                  </div>
                </div>

                <div className="summary-section">
                  <h4>פירוט לפי ימים</h4>
                  <div className="summary-days-list">
                    {sprintDays.map((day) => (
                      <div className={`summary-day ${day.tasks.length > 0 ? "has-tasks" : "is-empty"}`} key={day.date}>
                        <div className="summary-day-date">
                          <strong>{formatDate(day.date)}</strong>
                          <span>{getWeekday(day.date)} · {day.tasks.length > 0 ? `${day.tasks.length} משימות` : "אין משימות"}</span>
                        </div>

                        {day.tasks.length === 0 ? (
                          <p>לא נרשמו משימות ביום הזה.</p>
                        ) : (
                          <div className="summary-day-tasks">
                            {day.tasks.map((task) => {
                              const area = getWorkArea(task.workAreaId);
                              return (
                                <button className="summary-task-line" key={task.id} onClick={() => editTask(task)}>
                                  <span className="dot" style={{ backgroundColor: area?.color || "#2563eb" }} />
                                  <strong>{task.title}</strong>
                                  <small>{area?.name || "ללא תחום"} · {task.status}{task.expectedEndDate ? ` · צפי: ${formatDate(task.expectedEndDate)}` : ""}</small>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <aside className="copy-text-card">
                <div className="card-title">
                  <h3>טקסט שיועתק</h3>
                  <button className="ghost small" onClick={copySummary}>העתק</button>
                </div>
                <pre className="summary-plain-text">{sprintText}</pre>
              </aside>
            </div>
          </section>
        )}

        {activeTab === "newSprint" && (
          <section className="page-grid">
            <div className="card wide new-sprint-card">
              <h3>יצירת ספרינט חדש</h3>
              <p className="helper-text">יצירת ספרינט חדש תסגור את הספרינט הפעיל הנוכחי ותגדיר את החדש כפעיל.</p>
              <form onSubmit={createSprint} className="form">
                <label>שם ספרינט<input value={sprintForm.name} onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })} placeholder="לדוגמה: Sprint 14" /></label>
                <div className="two-cols">
                  <label>תאריך התחלה<input type="date" value={sprintForm.startDate} onChange={(e) => setSprintForm({ ...sprintForm, startDate: e.target.value })} /></label>
                  <label>תאריך סיום<input type="date" value={sprintForm.endDate} onChange={(e) => setSprintForm({ ...sprintForm, endDate: e.target.value })} /></label>
                </div>
                <button className="primary" type="submit">צור ספרינט והפוך לפעיל</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="page-grid">
            <div className="card wide">
              <h3>היסטוריית ספרינטים</h3>
              <div className="sprint-list">
                {sprints.map((sprint) => {
                  const count = tasks.filter((task) => task.sprintId === sprint.id).length;
                  return <div className="sprint-row" key={sprint.id}><div><strong>{sprint.name}</strong><p>{formatDate(sprint.startDate)} - {formatDate(sprint.endDate)} · {count} משימות</p></div><span className={sprint.status === "active" ? "pill success" : "pill"}>{sprint.status === "active" ? "פעיל" : "סגור"}</span>{sprint.status !== "active" && <button onClick={() => activateSprint(sprint.id)}>הפעל</button>}</div>;
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="page-grid">
            <div className="card wide">
              <h3>ניהול תחומי עבודה</h3>
              <form onSubmit={addWorkArea} className="inline-form">
                <input value={newWorkArea.name} onChange={(e) => setNewWorkArea({ ...newWorkArea, name: e.target.value })} placeholder="שם תחום חדש" />
                <input type="color" value={newWorkArea.color} onChange={(e) => setNewWorkArea({ ...newWorkArea, color: e.target.value })} />
                <button className="primary" type="submit">הוסף</button>
              </form>
              <div className="settings-list">
                {workAreas.map((area) => <div className="settings-row" key={area.id}><input value={area.name} onChange={(e) => renameWorkArea(area.id, e.target.value)} /><input type="color" value={area.color} onChange={(e) => updateWorkAreaColor(area.id, e.target.value)} /><button className="danger" onClick={() => removeWorkArea(area.id)}>מחק</button></div>)}
              </div>
            </div>

            <div className="card wide">
              <h3>ניהול סוגי פעילות</h3>
              <form onSubmit={addCategory} className="inline-form"><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="סוג פעילות חדש" /><button className="primary" type="submit">הוסף</button></form>
              <div className="chips">{categories.map((category) => <span key={category}>{category}</span>)}</div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
