/* ==========================================================================
   TaskFlow - app.js
   00 Shared Foundation | 01 Navigation | 02 Dashboard | 03 My Tasks
   04 Personal Journal | 05 Goals & Plans | 06 Daily Habits | 07 Initialisation
   ========================================================================== */

/* ==========================================================================
   00. SHARED FOUNDATION
   ========================================================================== */

/* ---------- Storage keys ---------- */
const STORAGE_KEYS = {
  tasks: "Tasks",
  journal: "JournalEntries",
  goals: "Goals",
  habits: "Habits",
};

/* ---------- Generic helpers ---------- */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));

    return Array.isArray(parsed) ? parsed.filter(isPlainObject) : [];
  } catch {
    return [];
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`TaskFlow: could not save "${key}".`, error);
  }
}

/* ---------- Date helpers ---------- */

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDisplayDate(dateString) {
  if (!dateString) {
    return "No date";
  }

  const date = parseLocalDate(dateString);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function addDays(dateString, amount) {
  const date = parseLocalDate(dateString);

  date.setDate(date.getDate() + amount);

  return getLocalDateString(date);
}

function daysBetween(fromDateString, toDateString) {
  return Math.round(
    (parseLocalDate(toDateString) - parseLocalDate(fromDateString)) / 86400000,
  );
}

/* ---------- Small value + DOM helpers ---------- */

function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function clampPercent(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, Math.round(number)))
    : 0;
}

function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function createElement(tag, className = "", text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createButton(label, className, dataset = {}) {
  const button = createElement("button", className, label);

  button.type = "button";
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });

  return button;
}

function createBadge(text, tone = "neutral") {
  return createElement("span", `badge badge--${tone}`, text);
}

function createEmptyState(message) {
  return createElement("p", "empty-state", message);
}

function setProgressBar(trackElement, fillElement, percent) {
  const safePercent = clampPercent(percent);

  fillElement.style.width = `${safePercent}%`;
  trackElement.setAttribute("aria-valuenow", String(safePercent));
}

function createProgressBar(label, percent, modifiers = "") {
  const track = createElement("div", `progress-bar ${modifiers}`.trim());
  const fill = createElement("div", "progress-bar__fill");

  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.appendChild(fill);
  setProgressBar(track, fill, percent);

  return track;
}

/* ---------- Shared data ---------- */

function ensureIds(list) {
  list.forEach((item) => {
    item.id = item.id ? String(item.id) : createId();
  });

  return list;
}

function normaliseTask(task) {
  return {
    ...task,
    title: String(task.title ?? ""),
    description: String(task.description ?? ""),
    priority: ["low", "medium", "high"].includes(task.priority)
      ? task.priority
      : "low",
    date: task.date ? String(task.date) : "",
    completed: task.completed === true,
  };
}

function normaliseEntry(entry) {
  return {
    ...entry,
    title: String(entry.title ?? ""),
    content: String(entry.content ?? ""),
    date: entry.date ? String(entry.date) : "",
  };
}

function normaliseMilestones(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter(isPlainObject)
    .map((step) => ({
      id: step.id ? String(step.id) : createId(),
      title: String(step.title ?? "").trim(),
      done: step.done === true,
    }))
    .filter((step) => step.title);
}

function calculateGoalProgress(goal) {
  const milestones = goal.milestones || [];

  if (milestones.length === 0) {
    return clampPercent(goal.progress);
  }

  const doneCount = milestones.filter((step) => step.done).length;

  return Math.round((doneCount / milestones.length) * 100);
}

function isGoalCompleted(goal) {
  return goal.progress >= 100;
}

function normaliseGoal(goal) {
  const milestones = normaliseMilestones(goal.milestones);

  return {
    ...goal,
    title: String(goal.title ?? ""),
    description: String(goal.description ?? ""),
    category: String(goal.category || "other"),
    targetDate: goal.targetDate ? String(goal.targetDate) : "",
    milestones,
    progress: calculateGoalProgress({ milestones, progress: goal.progress }),
  };
}

function normaliseHabit(habit) {
  return {
    ...habit,
    title: String(habit.title ?? ""),
    description: String(habit.description ?? ""),
    startDate: habit.startDate
      ? String(habit.startDate)
      : getLocalDateString(),
    duration: Number(habit.duration) || 30,
    schedule: habit.schedule === "selected-days" ? "selected-days" : "daily",
    weekdays: Array.isArray(habit.weekdays) ? habit.weekdays.map(Number) : [],
    completedDates: Array.isArray(habit.completedDates)
      ? habit.completedDates
      : [],
  };
}

let tasks = ensureIds(readStorage(STORAGE_KEYS.tasks)).map(normaliseTask);
let journalEntries = ensureIds(readStorage(STORAGE_KEYS.journal)).map(
  normaliseEntry,
);
let goals = ensureIds(readStorage(STORAGE_KEYS.goals)).map(normaliseGoal);
let habits = ensureIds(readStorage(STORAGE_KEYS.habits)).map(normaliseHabit);

writeStorage(STORAGE_KEYS.tasks, tasks);
writeStorage(STORAGE_KEYS.journal, journalEntries);
writeStorage(STORAGE_KEYS.goals, goals);
writeStorage(STORAGE_KEYS.habits, habits);

/* ==========================================================================
   01. NAVIGATION
   ========================================================================== */

/* ---------- DOM references ---------- */
const navigationButtons = document.querySelectorAll(".nav-button");
const appViews = document.querySelectorAll(".app-view");
const siteHeader = document.querySelector(".app-header");
const navToggleButton = document.querySelector("#nav-toggle-button");
const navBackdrop = document.querySelector("#nav-backdrop");
const progressToggleButton = document.querySelector("#progress-toggle-button");
const progressToggleLabel = document.querySelector(".progress-toggle-label");
const progressDashboard = document.querySelector("#progress-dashboard");
const desktopNavBreakpoint = 860;

/* ---------- View switching ---------- */

function switchView(selectedView) {
  appViews.forEach((view) => {
    view.hidden = view.id !== `${selectedView}-view`;
  });

  navigationButtons.forEach((button) => {
    const isActive = button.dataset.view === selectedView;

    button.classList.toggle("active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  progressToggleButton.hidden = selectedView !== "dashboard";

  if (selectedView === "dashboard") {
    renderDashboard();
  }

  window.scrollTo({ top: 0 });
}

/* ---------- Mobile menu ---------- */

function setMobileNavOpen(isOpen) {
  siteHeader.classList.toggle("nav-open", isOpen);
  document.body.classList.toggle("nav-locked", isOpen);
  navToggleButton.setAttribute("aria-expanded", String(isOpen));
  navToggleButton.setAttribute(
    "aria-label",
    isOpen ? "Close menu" : "Open menu",
  );
  navBackdrop.hidden = !isOpen;
}

/* ---------- Event listeners ---------- */

navigationButtons.forEach((button) => {
  button.addEventListener("click", function () {
    switchView(button.dataset.view);
    setMobileNavOpen(false);
  });
});

document.addEventListener("click", function (event) {
  const link = event.target.closest("[data-view-link]");

  if (link) {
    switchView(link.dataset.viewLink);
  }
});

navToggleButton.addEventListener("click", function () {
  setMobileNavOpen(!siteHeader.classList.contains("nav-open"));
});

navBackdrop.addEventListener("click", function () {
  setMobileNavOpen(false);
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    setMobileNavOpen(false);
  }
});

window.addEventListener("resize", function () {
  if (window.innerWidth > desktopNavBreakpoint) {
    setMobileNavOpen(false);
  }
});

progressToggleButton.addEventListener("click", function () {
  progressDashboard.hidden = !progressDashboard.hidden;

  const label = progressDashboard.hidden
    ? "Show Progress Overview"
    : "Hide Progress Overview";

  progressToggleLabel.textContent = label;
  progressToggleButton.setAttribute("aria-label", label);
});

/* ==========================================================================
   02. DASHBOARD
   ========================================================================== */

/* ---------- DOM references ---------- */

const dashboardDate = document.querySelector("#dashboard-date");
const dashboardGreeting = document.querySelector("#dashboard-greeting");
const dashboardMessage = document.querySelector("#dashboard-message");
const dashboardAchievements = document.querySelector("#dashboard-achievements");
const overallRing = document.querySelector("#overall-ring");
const overallRingArc = document.querySelector("#overall-ring-arc");
const overallPercent = document.querySelector("#overall-percent");

const progressPercent = document.querySelector("#progress-percent");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const completedCount = document.querySelector("#completed-count");
const totalCount = document.querySelector("#total-count");
const totalTasks = document.querySelector("#total-tasks");
const completedTasks = document.querySelector("#completed-tasks");
const remainingTasks = document.querySelector("#remaining-tasks");

const dashGoalsPercent = document.querySelector("#dash-goals-percent");
const dashGoalsTrack = document.querySelector("#dash-goals-track");
const dashGoalsFill = document.querySelector("#dash-goals-fill");
const dashGoalsCaption = document.querySelector("#dash-goals-caption");
const dashGoalsTotal = document.querySelector("#dash-goals-total");
const dashGoalsActive = document.querySelector("#dash-goals-active");
const dashGoalsDone = document.querySelector("#dash-goals-done");

const dashHabitsPercent = document.querySelector("#dash-habits-percent");
const dashHabitsTrack = document.querySelector("#dash-habits-track");
const dashHabitsFill = document.querySelector("#dash-habits-fill");
const dashHabitsCaption = document.querySelector("#dash-habits-caption");
const dashHabitsTotal = document.querySelector("#dash-habits-total");
const dashHabitsDone = document.querySelector("#dash-habits-done");
const dashHabitsStreak = document.querySelector("#dash-habits-streak");

const dashboardFocus = document.querySelector("#dashboard-focus");
const dashboardUpcomingList = document.querySelector(
  "#dashboard-upcoming-list",
);
const dashboardHabitsList = document.querySelector("#dashboard-habits-list");
const dashboardGoalsList = document.querySelector("#dashboard-goals-list");

/* ---------- Summaries ---------- */

function getTaskSummary() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;

  return {
    total,
    completed,
    remaining: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function getGoalSummary() {
  const total = goals.length;
  const completed = goals.filter(isGoalCompleted).length;
  const progressSum = goals.reduce((sum, goal) => sum + goal.progress, 0);

  return {
    total,
    completed,
    active: total - completed,
    averageProgress: total === 0 ? 0 : Math.round(progressSum / total),
  };
}

function getOverallMomentum(taskSummary, goalSummary, habitSummary) {
  const scores = [];

  if (taskSummary.total > 0) {
    scores.push(taskSummary.percent);
  }

  if (goalSummary.total > 0) {
    scores.push(goalSummary.averageProgress);
  }

  if (habitSummary.scheduled.length > 0) {
    scores.push(habitSummary.percent);
  }

  if (scores.length === 0) {
    return { hasData: false, percent: 0 };
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return { hasData: true, percent: Math.round(average) };
}

/* ---------- Hero text ---------- */

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  return hour < 18 ? "Good afternoon" : "Good evening";
}

function getMotivationMessage(momentum) {
  if (!momentum.hasData) {
    return "Add your first task, goal or habit and watch your momentum build.";
  }

  if (momentum.percent >= 100) {
    return "Perfect score! Everything is on track. Take a moment to celebrate.";
  }

  if (momentum.percent >= 75) {
    return "You are on fire. Almost everything is done, keep that momentum going!";
  }

  if (momentum.percent >= 40) {
    return "Great progress. Steady steps are adding up to something big.";
  }

  if (momentum.percent > 0) {
    return "Good start. Every small win counts, keep moving forward.";
  }

  return "A fresh start. Pick one small thing and tick it off today.";
}

function getAchievements(taskSummary, goalSummary, habitSummary) {
  const achievements = [];

  if (taskSummary.total > 0 && taskSummary.remaining === 0) {
    achievements.push("All tasks cleared");
  } else if (taskSummary.completed > 0) {
    achievements.push(`${pluralise(taskSummary.completed, "task")} finished`);
  }

  if (goalSummary.completed > 0) {
    achievements.push(`${pluralise(goalSummary.completed, "goal")} achieved`);
  }

  if (
    habitSummary.scheduled.length > 0 &&
    habitSummary.completed.length === habitSummary.scheduled.length
  ) {
    achievements.push("Perfect habit day");
  }

  if (habitSummary.bestStreak >= 3) {
    achievements.push(`${habitSummary.bestStreak}-day streak`);
  }

  return achievements;
}

/* ---------- Rendering ---------- */

function renderDashboardHero(taskSummary, goalSummary, habitSummary) {
  const momentum = getOverallMomentum(taskSummary, goalSummary, habitSummary);

  dashboardDate.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  dashboardGreeting.textContent = `${getGreeting()}, let's make today count`;
  dashboardMessage.textContent = getMotivationMessage(momentum);

  overallPercent.textContent = `${momentum.percent}%`;
  overallRingArc.style.setProperty("--ring-value", String(momentum.percent));
  overallRing.setAttribute(
    "aria-label",
    `Overall momentum ${momentum.percent} percent`,
  );

  dashboardAchievements.innerHTML = "";

  const achievements = getAchievements(taskSummary, goalSummary, habitSummary);

  if (achievements.length === 0) {
    dashboardAchievements.appendChild(
      createElement(
        "span",
        "dash-achievement dash-achievement--muted",
        "Complete a task to earn your first badge",
      ),
    );
    return;
  }

  achievements.forEach((text) => {
    dashboardAchievements.appendChild(
      createElement("span", "dash-achievement", text),
    );
  });
}

function renderDashboardPanels(taskSummary, goalSummary, habitSummary) {
  progressPercent.textContent = `${taskSummary.percent}%`;
  setProgressBar(progressTrack, progressFill, taskSummary.percent);
  completedCount.textContent = taskSummary.completed;
  totalCount.textContent = taskSummary.total;
  totalTasks.textContent = taskSummary.total;
  completedTasks.textContent = taskSummary.completed;
  remainingTasks.textContent = taskSummary.remaining;

  dashGoalsPercent.textContent = `${goalSummary.averageProgress}%`;
  setProgressBar(dashGoalsTrack, dashGoalsFill, goalSummary.averageProgress);
  dashGoalsCaption.textContent =
    goalSummary.total === 0
      ? "No goals yet. Set your first goal!"
      : `${goalSummary.completed} of ${pluralise(goalSummary.total, "goal")} achieved`;
  dashGoalsTotal.textContent = goalSummary.total;
  dashGoalsActive.textContent = goalSummary.active;
  dashGoalsDone.textContent = goalSummary.completed;

  dashHabitsPercent.textContent = `${habitSummary.percent}%`;
  setProgressBar(dashHabitsTrack, dashHabitsFill, habitSummary.percent);
  dashHabitsCaption.textContent =
    habits.length === 0
      ? "No habits yet. Start building one!"
      : habitSummary.scheduled.length === 0
        ? "Nothing scheduled for today"
        : `${habitSummary.completed.length} of ${habitSummary.scheduled.length} habits done today`;
  dashHabitsTotal.textContent = habits.length;
  dashHabitsDone.textContent = habitSummary.completed.length;
  dashHabitsStreak.textContent = habitSummary.bestStreak;
}

function renderUpcomingTasks() {
  dashboardUpcomingList.innerHTML = "";

  const upcoming = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;

      return a.date.localeCompare(b.date);
    })
    .slice(0, 4);

  if (upcoming.length === 0) {
    dashboardUpcomingList.appendChild(
      createElement(
        "li",
        "focus-empty",
        tasks.length === 0
          ? "No tasks yet. Add one to get going."
          : "All caught up. Great work!",
      ),
    );
    return;
  }

  upcoming.forEach((task) => {
    const status = getDueStatus(task);
    const item = createElement("li", "focus-item");

    const check = createButton("", "focus-check", { completeTask: task.id });
    check.setAttribute("aria-label", `Mark "${task.title}" as completed`);

    const body = createElement("div", "focus-item__body");

    body.append(
      createElement("span", "focus-item__title", task.title),
      createElement(
        "span",
        "focus-item__meta",
        `${capitalise(task.priority)} priority · ${formatDisplayDate(task.date)}`,
      ),
    );

    item.append(check, body);

    if (status.label) {
      item.appendChild(createBadge(status.label, status.tone));
    }

    dashboardUpcomingList.appendChild(item);
  });
}

function renderTodaysHabits(habitSummary) {
  dashboardHabitsList.innerHTML = "";

  if (habitSummary.scheduled.length === 0) {
    dashboardHabitsList.appendChild(
      createElement(
        "li",
        "focus-empty",
        habits.length === 0
          ? "No habits yet. Build your first one."
          : "No habits scheduled for today.",
      ),
    );
    return;
  }

  const today = getLocalDateString();

  habitSummary.scheduled.slice(0, 5).forEach((habit) => {
    const isDone = habit.completedDates.includes(today);
    const stats = getHabitStats(habit);
    const item = createElement("li", "focus-item");

    const check = createButton(
      "",
      `focus-check${isDone ? " is-done" : ""}`,
      { toggleHabit: habit.id },
    );
    check.setAttribute(
      "aria-label",
      `${isDone ? "Undo" : "Complete"} "${habit.title}" for today`,
    );
    check.setAttribute("aria-pressed", String(isDone));

    const body = createElement("div", "focus-item__body");

    body.append(
      createElement("span", "focus-item__title", habit.title),
      createElement(
        "span",
        "focus-item__meta",
        stats.currentStreak > 0
          ? `Streak: ${pluralise(stats.currentStreak, "day")}`
          : "Start your streak today",
      ),
    );

    item.append(check, body);
    dashboardHabitsList.appendChild(item);
  });
}

function renderGoalsInMotion() {
  dashboardGoalsList.innerHTML = "";

  const inMotion = goals
    .filter((goal) => !isGoalCompleted(goal))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  if (inMotion.length === 0) {
    dashboardGoalsList.appendChild(
      createElement(
        "li",
        "focus-empty",
        goals.length === 0
          ? "No goals yet. Set your first goal."
          : "All goals achieved. Time to dream bigger!",
      ),
    );
    return;
  }

  inMotion.forEach((goal) => {
    const item = createElement("li", "focus-item");
    const body = createElement("div", "focus-item__body");

    const track = createProgressBar(
      `${goal.title} progress`,
      goal.progress,
      "progress-bar--sm progress-bar--teal",
    );

    body.append(
      createElement("span", "focus-item__title", goal.title),
      createElement(
        "span",
        "focus-item__meta",
        `Target: ${formatDisplayDate(goal.targetDate)}`,
      ),
      track,
    );

    item.append(
      body,
      createElement("span", "focus-item__value", `${goal.progress}%`),
    );
    dashboardGoalsList.appendChild(item);
  });
}

function renderDashboard() {
  const taskSummary = getTaskSummary();
  const goalSummary = getGoalSummary();
  const habitSummary = getHabitsTodaySummary();

  renderDashboardHero(taskSummary, goalSummary, habitSummary);
  renderDashboardPanels(taskSummary, goalSummary, habitSummary);
  renderUpcomingTasks();
  renderTodaysHabits(habitSummary);
  renderGoalsInMotion();
}

/* ---------- Event listeners ---------- */

dashboardFocus.addEventListener("click", function (event) {
  const taskButton = event.target.closest("[data-complete-task]");

  if (taskButton) {
    completeTask(taskButton.dataset.completeTask);
    return;
  }

  const habitButton = event.target.closest("[data-toggle-habit]");

  if (habitButton) {
    toggleHabitCompletion(habitButton.dataset.toggleHabit, getLocalDateString());
  }
});

/* ==========================================================================
   03. MY TASKS
   ========================================================================== */

/* ---------- DOM references ---------- */
const taskForm = document.querySelector("#task-form");
const taskFormHeading = document.querySelector("#task-form-heading");
const taskTitle = document.querySelector("#task-title");
const taskDescription = document.querySelector("#task-description");
const taskPriority = document.querySelector("#task-priority");
const taskDueDate = document.querySelector("#task-due-date");
const taskList = document.querySelector("#task-list");
const submitButton = document.querySelector("#submit-task-button");
const searchInput = document.querySelector("#task-search-input");
const cancelTaskEdit = document.querySelector("#cancel-task-edit");
const taskFilterButtons = document.querySelectorAll(".task-filter-button");
const taskFilterCount = document.querySelector("#task-filter-count");

/* ---------- State ---------- */
let editingTaskID = null;
let activeTaskFilter = "active";

/* ---------- Data: save + refresh ---------- */

function commitTasks() {
  writeStorage(STORAGE_KEYS.tasks, tasks);
  renderTaskList();
  renderDashboard();
}

function completeTask(taskID) {
  const task = tasks.find((item) => item.id === taskID);

  if (!task) {
    return;
  }

  task.completed = true;
  commitTasks();
}

/* ---------- Due-date status ---------- */

function getDueStatus(task) {
  if (task.completed) {
    return { label: "Completed", tone: "neutral" };
  }

  if (!task.date) {
    return { label: "", tone: "neutral" };
  }

  const today = getLocalDateString();

  if (task.date < today) {
    return { label: "Overdue", tone: "danger" };
  }

  if (task.date === today) {
    return { label: "Due today", tone: "warning" };
  }

  return { label: "Upcoming", tone: "success" };
}

/* ---------- Rendering ---------- */

function createTaskCard(task) {
  const card = createElement("div", `task-card task-card--${task.priority}`);
  const status = getDueStatus(task);

  const heading = createElement("h3", "", task.title);

  const priorityTone = { high: "danger", medium: "warning", low: "brand" };
  const meta = createElement("div", "task-card-meta");
  const dueText = task.date
    ? `${formatDisplayDate(task.date)}${status.label ? ` · ${status.label}` : ""}`
    : "No due date";

  meta.append(
    createBadge(
      `Priority: ${capitalise(task.priority)}`,
      priorityTone[task.priority],
    ),
    createBadge(dueText, task.date ? status.tone : "neutral"),
  );

  const description = createElement(
    "p",
    "task-description description-collapsed",
    task.description,
  );

  const readMore = createButton("Read more", "read-more-button");
  readMore.hidden = true;
  readMore.addEventListener("click", function () {
    const isExpanded = description.classList.toggle("description-expanded");

    description.classList.toggle("description-collapsed", !isExpanded);
    readMore.textContent = isExpanded ? "Show less" : "Read more";
  });

  const completeButton = createButton(
    task.completed ? "Reopen" : "Mark Completed",
    task.completed
      ? "btn btn-neutral btn-block task-complete-button"
      : "btn btn-primary btn-block task-complete-button",
    { action: "complete", id: task.id },
  );

  const actions = createElement("div", "task-action-buttons");

  actions.append(
    createButton("Edit", "btn btn-soft btn-sm", {
      action: "edit",
      id: task.id,
    }),
    createButton("Delete", "btn btn-danger btn-sm", {
      action: "delete",
      id: task.id,
    }),
  );

  card.append(heading, meta, description, readMore, completeButton, actions);

  return card;
}

function updateReadMoreButtons() {
  taskList.querySelectorAll(".task-card").forEach((card) => {
    const description = card.querySelector(".task-description");
    const readMore = card.querySelector(".read-more-button");
    const isExpanded = description.classList.contains("description-expanded");

    readMore.hidden =
      !isExpanded &&
      !(
        description.textContent.trim().length > 0 &&
        description.scrollHeight > description.clientHeight + 1
      );
  });
}

function renderTaskList() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    if (activeTaskFilter === "active") {
      return !task.completed;
    }

    if (activeTaskFilter === "completed") {
      return task.completed === true;
    }

    return true;
  });
  const matchedTasks = filteredTasks.filter((task) =>
    String(task.title || "").toLowerCase().includes(searchTerm),
  );

  taskList.innerHTML = "";
  taskFilterCount.textContent = `Showing ${matchedTasks.length} ${activeTaskFilter}`;

  if (matchedTasks.length === 0) {
    let message = "No tasks match your search.";

    if (tasks.length === 0) {
      message = "No tasks yet. Add your first task.";
    } else if (!searchTerm && activeTaskFilter === "active") {
      message = "No active tasks. Great work, or add a new one.";
    } else if (!searchTerm && activeTaskFilter === "completed") {
      message = "No completed tasks yet. Finish a task and it will show up here.";
    }

    taskList.appendChild(createEmptyState(message));
    return;
  }

  matchedTasks.forEach((task) => taskList.appendChild(createTaskCard(task)));
  requestAnimationFrame(updateReadMoreButtons);
}

/* ---------- Form helpers ---------- */

function resetTaskForm() {
  taskForm.reset();
  editingTaskID = null;
  taskFormHeading.textContent = "Add a New Task";
  submitButton.textContent = "Add Task";
  cancelTaskEdit.hidden = true;
}

/* ---------- Event listeners ---------- */

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const taskData = {
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    priority: taskPriority.value,
    date: taskDueDate.value,
  };

  if (!taskData.title) {
    taskTitle.focus();
    return;
  }

  if (editingTaskID === null) {
    tasks.push({ id: createId(), ...taskData, completed: false });
  } else {
    const existingTask = tasks.find((task) => task.id === editingTaskID);

    if (existingTask) {
      Object.assign(existingTask, taskData);
    }
  }

  resetTaskForm();
  commitTasks();
});

cancelTaskEdit.addEventListener("click", resetTaskForm);

searchInput.addEventListener("input", renderTaskList);

taskFilterButtons.forEach((button) => {
  button.addEventListener("click", function () {
    activeTaskFilter = button.dataset.taskFilter || "all";

    taskFilterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;
      filterButton.classList.toggle("active", isSelected);
      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    renderTaskList();
  });
});

taskList.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const taskID = button.dataset.id;

  if (button.dataset.action === "complete") {
    const task = tasks.find((item) => item.id === taskID);

    if (task) {
      task.completed = !task.completed;
      commitTasks();
    }
    return;
  }

  if (button.dataset.action === "edit") {
    const task = tasks.find((item) => item.id === taskID);

    if (!task) {
      return;
    }

    editingTaskID = task.id;
    taskTitle.value = task.title;
    taskDescription.value = task.description;
    taskPriority.value = task.priority;
    taskDueDate.value = task.date;
    taskFormHeading.textContent = "Edit Task";
    submitButton.textContent = "Save Changes";
    cancelTaskEdit.hidden = false;

    document
      .querySelector("#task-form-section")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete") {
    if (editingTaskID === taskID) {
      resetTaskForm();
    }

    tasks = tasks.filter((task) => task.id !== taskID);
    commitTasks();
  }
});

let readMoreResizeTimer = null;

window.addEventListener("resize", function () {
  clearTimeout(readMoreResizeTimer);
  readMoreResizeTimer = setTimeout(updateReadMoreButtons, 150);
});

/* ==========================================================================
   04. PERSONAL JOURNAL
   ========================================================================== */

/* ---------- DOM references ---------- */
const journalForm = document.querySelector("#journal-form");
const journalTitle = document.querySelector("#journal-title");
const journalContent = document.querySelector("#journal-content");
const journalDate = document.querySelector("#journal-date");
const journalSearch = document.querySelector("#journal-search");
const journalEntriesList = document.querySelector("#journal-entries-list");
const journalSubmitButton = document.querySelector("#journal-submit-button");
const journalCancelEdit = document.querySelector("#journal-cancel-edit");

/* ---------- State ---------- */
let editingJournalID = null;

/* ---------- Data + rendering ---------- */

function saveJournal() {
  writeStorage(STORAGE_KEYS.journal, journalEntries);
  renderJournalEntries();
}

function createJournalEntryCard(entry) {
  const card = createElement("div", "journal-entry");
  const head = createElement("div", "journal-entry__head");

  head.append(
    createElement("h3", "journal-entry__title", entry.title),
    createBadge(
      entry.date ? formatDisplayDate(entry.date) : "No date",
      "brand",
    ),
  );

  const actions = createElement("div", "journal-entry__actions");

  actions.append(
    createButton("Edit", "btn btn-soft btn-sm", {
      action: "edit",
      id: entry.id,
    }),
    createButton("Delete", "btn btn-danger btn-sm", {
      action: "delete",
      id: entry.id,
    }),
  );

  card.append(
    head,
    createElement("p", "journal-entry__content", entry.content),
    actions,
  );

  return card;
}

function renderJournalEntries() {
  const searchTerm = journalSearch.value.trim().toLowerCase();

  const visibleEntries = journalEntries
    .filter((entry) => {
      return (
        entry.title.toLowerCase().includes(searchTerm) ||
        entry.content.toLowerCase().includes(searchTerm)
      );
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  journalEntriesList.innerHTML = "";

  if (visibleEntries.length === 0) {
    journalEntriesList.appendChild(
      createEmptyState(
        journalEntries.length === 0
          ? "Your journal is ready. Save your first reflection above."
          : "No entries match your search.",
      ),
    );
    return;
  }

  visibleEntries.forEach((entry) => {
    journalEntriesList.appendChild(createJournalEntryCard(entry));
  });
}

/* ---------- Form helpers ---------- */

function resetJournalForm() {
  journalForm.reset();
  journalDate.value = getLocalDateString();
  editingJournalID = null;
  journalSubmitButton.textContent = "Save Entry";
  journalCancelEdit.hidden = true;
}

/* ---------- Event listeners ---------- */

journalForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const entryData = {
    title: journalTitle.value.trim(),
    content: journalContent.value,
    date: journalDate.value,
  };

  if (editingJournalID !== null) {
    const existingEntry = journalEntries.find(
      (entry) => entry.id === editingJournalID,
    );

    if (existingEntry) {
      Object.assign(existingEntry, entryData);
    }
  } else {
    journalEntries.push({ id: createId(), ...entryData });
  }

  resetJournalForm();
  saveJournal();
});

journalSearch.addEventListener("input", renderJournalEntries);

journalCancelEdit.addEventListener("click", resetJournalForm);

journalEntriesList.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const entryID = button.dataset.id;

  if (button.dataset.action === "delete") {
    if (editingJournalID === entryID) {
      resetJournalForm();
    }

    journalEntries = journalEntries.filter((entry) => entry.id !== entryID);
    saveJournal();
    return;
  }

  if (button.dataset.action === "edit") {
    const entry = journalEntries.find((item) => item.id === entryID);

    if (!entry) {
      return;
    }

    journalTitle.value = entry.title;
    journalContent.value = entry.content;
    journalDate.value = entry.date;
    editingJournalID = entry.id;
    journalSubmitButton.textContent = "Save Changes";
    journalCancelEdit.hidden = false;
    journalForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

/* ==========================================================================
   05. GOALS & PLANS
   ========================================================================== */

/* ---------- DOM references ---------- */
const addGoalButton = document.querySelector("#add-goal-button");

const totalGoals = document.querySelector("#total-goals");
const activeGoals = document.querySelector("#active-goals");
const completedGoals = document.querySelector("#completed-goals");

const goalFormSection = document.querySelector("#goal-form-section");
const goalFormHeading = document.querySelector("#goal-form-heading");
const goalForm = document.querySelector("#goal-form");
const goalTitle = document.querySelector("#goal-title");
const goalDescription = document.querySelector("#goal-description");
const goalCategory = document.querySelector("#goal-category");
const goalTargetDate = document.querySelector("#goal-target-date");
const goalMilestoneInput = document.querySelector("#goal-milestone-input");
const addMilestoneButton = document.querySelector("#add-milestone-button");
const goalMilestoneList = document.querySelector("#goal-milestone-list");
const goalProgress = document.querySelector("#goal-progress");
const goalProgressHint = document.querySelector("#goal-progress-hint");
const saveGoalButton = document.querySelector("#save-goal-button");
const cancelGoalButton = document.querySelector("#cancel-goal-button");

const goalFilterButtons = document.querySelectorAll(".goal-filter-button");
const goalsList = document.querySelector("#goals-list");

/* ---------- State ---------- */
const MAX_MILESTONES = 10;
const FILTER_REFRESH_DELAY = 900;

let editingGoalID = null;
let activeGoalFilter = "all";
let draftMilestones = [];
let filterRefreshTimer = null;

/* ---------- Data ---------- */

function commitGoals() {
  writeStorage(STORAGE_KEYS.goals, goals);
  renderGoals();
  renderDashboard();
}

function getFilteredGoals() {
  if (activeGoalFilter === "active") {
    return goals.filter((goal) => !isGoalCompleted(goal));
  }

  if (activeGoalFilter === "completed") {
    return goals.filter(isGoalCompleted);
  }

  return goals;
}

function toggleGoalMilestone(card, stepID, isDone) {
  const goal = goals.find((item) => item.id === card.dataset.goalId);
  const step = goal && goal.milestones.find((item) => item.id === stepID);

  if (!step) {
    return;
  }

  step.done = isDone;
  goal.progress = calculateGoalProgress(goal);

  writeStorage(STORAGE_KEYS.goals, goals);
  syncGoalCard(card, goal);
  updateGoalStats();
  renderDashboard();
  scheduleGoalFilterRefresh();
}

function scheduleGoalFilterRefresh() {
  clearTimeout(filterRefreshTimer);

  const renderedCount = goalsList.querySelectorAll(".goal-card").length;

  if (getFilteredGoals().length !== renderedCount) {
    filterRefreshTimer = setTimeout(renderGoals, FILTER_REFRESH_DELAY);
  }
}

/* ---------- Rendering ---------- */

function getGoalProgressLabel(goal) {
  if (goal.milestones.length === 0) {
    return "Progress";
  }

  const doneCount = goal.milestones.filter((step) => step.done).length;

  return `${doneCount} of ${pluralise(goal.milestones.length, "milestone")} done`;
}

function getGoalStatusBadges(goal) {
  const isCompleted = isGoalCompleted(goal);
  const badges = [
    isCompleted
      ? createBadge("Completed", "success")
      : createBadge("In Progress", "warning"),
  ];

  if (
    !isCompleted &&
    goal.targetDate &&
    daysBetween(getLocalDateString(), goal.targetDate) < 0
  ) {
    badges.push(createBadge("Past target date", "danger"));
  }

  return badges;
}

function getGoalTargetText(goal) {
  const daysLeft = goal.targetDate
    ? daysBetween(getLocalDateString(), goal.targetDate)
    : null;
  let text = `Target: ${formatDisplayDate(goal.targetDate)}`;

  if (!isGoalCompleted(goal) && daysLeft !== null) {
    if (daysLeft > 0) {
      text += ` · ${pluralise(daysLeft, "day")} left`;
    } else if (daysLeft === 0) {
      text += " · due today";
    }
  }

  return text;
}

function syncGoalCard(card, goal) {
  card.classList.toggle("is-complete", isGoalCompleted(goal));
  card.querySelector(".goal-progress-label").textContent =
    getGoalProgressLabel(goal);
  card.querySelector(".goal-progress-value").textContent = `${goal.progress}%`;
  card
    .querySelector(".goal-status-row")
    .replaceChildren(...getGoalStatusBadges(goal));
  card.querySelector(".goal-target-date").textContent = getGoalTargetText(goal);
  setProgressBar(
    card.querySelector(".progress-bar"),
    card.querySelector(".progress-bar__fill"),
    goal.progress,
  );
}

function createGoalDescription(goal) {
  const container = createElement("div", "goal-description-container");
  const description = createElement(
    "p",
    "goal-card-description",
    goal.description || "No description added.",
  );

  container.appendChild(description);

  if (goal.description && goal.description.length > 120) {
    const toggleButton = createButton("Read More", "goal-description-toggle");

    description.classList.add("is-collapsed");
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.addEventListener("click", function () {
      const isCollapsed = description.classList.toggle("is-collapsed");

      toggleButton.textContent = isCollapsed ? "Read More" : "Read Less";
      toggleButton.setAttribute("aria-expanded", String(!isCollapsed));
    });

    container.appendChild(toggleButton);
  }

  return container;
}

function createGoalMilestones(goal) {
  if (goal.milestones.length === 0) {
    return isGoalCompleted(goal)
      ? null
      : createElement(
          "p",
          "goal-card-hint",
          "Manual progress. Edit this goal to add milestones and track it automatically.",
        );
  }

  const list = createElement("ul", "goal-steps");

  goal.milestones.forEach((step) => {
    const item = createElement("li");
    const label = createElement("label", "goal-step");
    const checkbox = createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = step.done;
    checkbox.dataset.stepId = step.id;

    label.append(checkbox, createElement("span", "", step.title));
    item.appendChild(label);
    list.appendChild(item);
  });

  return list;
}

function createGoalCard(goal) {
  const card = createElement("article", "goal-card");

  card.dataset.goalId = goal.id;

  const header = createElement("div", "goal-card-header");

  header.append(
    createElement("h3", "goal-card-title", goal.title),
    createBadge(capitalise(goal.category), "brand"),
  );

  const progressInfo = createElement("div", "goal-progress-info");

  progressInfo.append(
    createElement("span", "goal-progress-label"),
    createElement("span", "goal-progress-value"),
  );

  const actions = createElement("div", "goal-card-actions");

  actions.append(
    createButton("Edit", "btn btn-soft btn-sm edit-goal-button", {
      action: "edit",
      id: goal.id,
    }),
    createButton("Delete", "btn btn-danger btn-sm delete-goal-button", {
      action: "delete",
      id: goal.id,
    }),
  );

  const milestones = createGoalMilestones(goal);

  card.append(
    header,
    createGoalDescription(goal),
    createElement("div", "goal-status-row"),
    progressInfo,
    createProgressBar(
      `${goal.title} progress`,
      goal.progress,
      "progress-bar--sm progress-bar--teal",
    ),
  );

  if (milestones) {
    card.appendChild(milestones);
  }

  card.append(createElement("p", "goal-target-date"), actions);
  syncGoalCard(card, goal);

  return card;
}

function updateGoalStats() {
  const completedTotal = goals.filter(isGoalCompleted).length;

  totalGoals.textContent = goals.length;
  completedGoals.textContent = completedTotal;
  activeGoals.textContent = goals.length - completedTotal;
}

function renderGoals() {
  const goalsToRender = getFilteredGoals();

  clearTimeout(filterRefreshTimer);
  goalsList.innerHTML = "";
  updateGoalStats();

  if (goalsToRender.length === 0) {
    goalsList.appendChild(
      createEmptyState(
        goals.length === 0
          ? "No goals yet. Add your first goal to get started!"
          : "No goals match this filter.",
      ),
    );
    return;
  }

  goalsToRender.forEach((goal) => goalsList.appendChild(createGoalCard(goal)));
}

/* ---------- Form helpers ---------- */

function renderMilestoneDraft() {
  const hasSteps = draftMilestones.length > 0;
  const isFull = draftMilestones.length >= MAX_MILESTONES;

  goalMilestoneList.replaceChildren(
    ...draftMilestones.map((step) => {
      const item = createElement("li", "milestone-item");
      const removeButton = createButton("×", "milestone-remove", {
        stepId: step.id,
      });

      removeButton.setAttribute(
        "aria-label",
        `Remove milestone "${step.title}"`,
      );
      item.append(createElement("span", "", step.title), removeButton);

      return item;
    }),
  );

  goalMilestoneInput.disabled = isFull;
  addMilestoneButton.disabled = isFull;
  goalProgress.disabled = hasSteps;

  if (hasSteps) {
    goalProgress.value = calculateGoalProgress({ milestones: draftMilestones });
  }

  goalProgressHint.textContent = hasSteps
    ? "Calculated automatically from your milestones."
    : "Set it manually, or add milestones to track it automatically.";
}

function addDraftMilestone() {
  const title = goalMilestoneInput.value.trim();

  if (!title || draftMilestones.length >= MAX_MILESTONES) {
    return;
  }

  draftMilestones.push({ id: createId(), title, done: false });
  goalMilestoneInput.value = "";
  renderMilestoneDraft();
}

function openGoalForm(goal = null) {
  goalForm.reset();
  editingGoalID = goal ? goal.id : null;
  draftMilestones = goal ? goal.milestones.map((step) => ({ ...step })) : [];

  goalFormHeading.textContent = goal ? "Edit Goal" : "Create a New Goal";
  saveGoalButton.textContent = goal ? "Update Goal" : "Save Goal";

  if (goal) {
    goalTitle.value = goal.title;
    goalDescription.value = goal.description;
    goalCategory.value = goal.category;
    goalTargetDate.value = goal.targetDate;
    goalProgress.value = goal.progress;
  }

  renderMilestoneDraft();
  goalFormSection.hidden = false;
  goalFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
  goalTitle.focus({ preventScroll: true });
}

function closeGoalForm() {
  goalForm.reset();
  editingGoalID = null;
  draftMilestones = [];
  renderMilestoneDraft();
  goalFormHeading.textContent = "Create a New Goal";
  saveGoalButton.textContent = "Save Goal";
  goalFormSection.hidden = true;
}

/* ---------- Event listeners ---------- */

addGoalButton.addEventListener("click", function () {
  openGoalForm();
});

cancelGoalButton.addEventListener("click", closeGoalForm);

addMilestoneButton.addEventListener("click", function () {
  addDraftMilestone();
  goalMilestoneInput.focus();
});

goalMilestoneInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addDraftMilestone();
  }
});

goalMilestoneList.addEventListener("click", function (event) {
  const removeButton = event.target.closest("[data-step-id]");

  if (!removeButton) {
    return;
  }

  draftMilestones = draftMilestones.filter(
    (step) => step.id !== removeButton.dataset.stepId,
  );
  renderMilestoneDraft();
});

goalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  addDraftMilestone();

  const milestones = draftMilestones.map((step) => ({ ...step }));
  const goalData = {
    title: goalTitle.value.trim(),
    description: goalDescription.value.trim(),
    category: goalCategory.value,
    targetDate: goalTargetDate.value,
    milestones,
    progress: calculateGoalProgress({
      milestones,
      progress: goalProgress.value,
    }),
  };

  if (editingGoalID !== null) {
    goals = goals.map((goal) =>
      goal.id === editingGoalID ? { ...goal, ...goalData } : goal,
    );
  } else {
    goals.push({ id: createId(), ...goalData });
  }

  closeGoalForm();
  commitGoals();
});

goalFilterButtons.forEach((button) => {
  button.addEventListener("click", function () {
    activeGoalFilter = button.dataset.filter;

    goalFilterButtons.forEach((filterButton) => {
      const isSelected = filterButton === button;

      filterButton.classList.toggle("active", isSelected);
      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    renderGoals();
  });
});

goalsList.addEventListener("change", function (event) {
  const checkbox = event.target.closest("input[data-step-id]");

  if (checkbox) {
    toggleGoalMilestone(
      checkbox.closest(".goal-card"),
      checkbox.dataset.stepId,
      checkbox.checked,
    );
  }
});

goalsList.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const goal = goals.find((item) => item.id === button.dataset.id);

  if (!goal) {
    return;
  }

  if (button.dataset.action === "edit") {
    openGoalForm(goal);
    return;
  }

  if (button.dataset.action === "delete") {
    if (editingGoalID === goal.id) {
      closeGoalForm();
    }

    goals = goals.filter((item) => item.id !== goal.id);
    commitGoals();
  }
});

/* ==========================================================================
   06. DAILY HABITS
   ========================================================================== */

/* ---------- DOM references ---------- */
const addHabitButton = document.querySelector("#add-habit-button");

const totalHabits = document.querySelector("#total-habits");
const completedHabitsToday = document.querySelector("#completed-habits-today");
const habitsProgressPercent = document.querySelector(
  "#habits-progress-percent",
);

const habitFormSection = document.querySelector("#habit-form-section");
const habitFormHeading = document.querySelector("#habit-form-heading");
const habitForm = document.querySelector("#habit-form");
const habitTitle = document.querySelector("#habit-title");
const habitDescription = document.querySelector("#habit-description");
const habitStartDate = document.querySelector("#habit-start-date");
const habitDuration = document.querySelector("#habit-duration");
const habitWeekdays = document.querySelector("#habit-weekdays");
const saveHabitButton = document.querySelector("#save-habit-button");
const cancelHabitButton = document.querySelector("#cancel-habit-button");

const habitsList = document.querySelector("#habits-list");
const habitScheduleOptions = document.querySelectorAll(
  'input[name="habit-schedule"]',
);
const habitWeekdayOptions = document.querySelectorAll(
  'input[name="habit-weekday"]',
);

/* ---------- State ---------- */
let editingHabitID = null;

/* ---------- Data: save + refresh ---------- */

function commitHabits() {
  writeStorage(STORAGE_KEYS.habits, habits);
  renderHabits();
  renderDashboard();
}

function toggleHabitCompletion(habitID, dateString) {
  const habit = habits.find((item) => item.id === habitID);

  if (!habit || !isHabitScheduled(habit, dateString)) {
    return;
  }

  if (habit.completedDates.includes(dateString)) {
    habit.completedDates = habit.completedDates.filter(
      (date) => date !== dateString,
    );
  } else {
    habit.completedDates.push(dateString);
  }

  commitHabits();
}

/* ---------- Schedule + statistics ---------- */

function isHabitScheduled(habit, dateString) {
  if (dateString < habit.startDate) {
    return false;
  }

  const elapsedDays = daysBetween(habit.startDate, dateString);

  if (elapsedDays < 0 || elapsedDays >= Number(habit.duration)) {
    return false;
  }

  if (habit.schedule === "daily") {
    return true;
  }

  return habit.weekdays.includes(parseLocalDate(dateString).getDay());
}

function getScheduledDates(habit) {
  const today = getLocalDateString();
  const scheduledDates = [];

  for (let i = 0; i < Number(habit.duration); i++) {
    const dateString = addDays(habit.startDate, i);

    if (dateString > today) {
      break;
    }

    if (isHabitScheduled(habit, dateString)) {
      scheduledDates.push(dateString);
    }
  }

  return scheduledDates;
}

function getHabitStats(habit) {
  const today = getLocalDateString();
  const scheduledDates = getScheduledDates(habit);

  const elapsedScheduledDates = scheduledDates.filter((date) => date < today);

  const completedDates = elapsedScheduledDates.filter((date) =>
    habit.completedDates.includes(date),
  );

  const consistency = elapsedScheduledDates.length
    ? Math.round((completedDates.length / elapsedScheduledDates.length) * 100)
    : 0;

  let currentRun = 0;
  let bestStreak = 0;

  scheduledDates.forEach((date) => {
    if (habit.completedDates.includes(date)) {
      currentRun++;
      bestStreak = Math.max(bestStreak, currentRun);
    } else if (date < today) {
      currentRun = 0;
    }
  });

  let currentStreak = 0;

  for (let i = scheduledDates.length - 1; i >= 0; i--) {
    const date = scheduledDates[i];

    if (date === today && !habit.completedDates.includes(date)) {
      continue;
    }

    if (habit.completedDates.includes(date)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    consistency,
    completedDays: completedDates.length,
    missedDays: elapsedScheduledDates.length - completedDates.length,
    currentStreak,
    bestStreak,
  };
}

function getHabitsTodaySummary() {
  const today = getLocalDateString();
  const scheduled = habits.filter((habit) => isHabitScheduled(habit, today));
  const completed = scheduled.filter((habit) =>
    habit.completedDates.includes(today),
  );

  return {
    scheduled,
    completed,
    percent: scheduled.length
      ? Math.round((completed.length / scheduled.length) * 100)
      : 0,
    bestStreak: habits.reduce(
      (best, habit) => Math.max(best, getHabitStats(habit).currentStreak),
      0,
    ),
  };
}

/* ---------- Rendering ---------- */

function createHabitWeek(habit) {
  const today = getLocalDateString();
  const week = createElement("div", "habit-week");
  const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];
  const stateLabels = {
    done: "Completed",
    missed: "Missed",
    pending: "Pending",
    off: "Not scheduled",
  };

  week.setAttribute("aria-label", "Last 7 days");

  for (let i = 6; i >= 0; i--) {
    const dateString = addDays(today, -i);
    let state = "off";

    if (isHabitScheduled(habit, dateString)) {
      if (habit.completedDates.includes(dateString)) {
        state = "done";
      } else {
        state = dateString === today ? "pending" : "missed";
      }
    }

    const day = createElement("div", "habit-week__day");
    const dot = createElement("span", `habit-week__dot habit-week__dot--${state}`);

    dot.title = `${formatDisplayDate(dateString)}: ${stateLabels[state]}`;

    day.append(
      dot,
      createElement(
        "span",
        "habit-week__label",
        dayLetters[parseLocalDate(dateString).getDay()],
      ),
    );
    week.appendChild(day);
  }

  return week;
}

function createHabitCard(habit) {
  const today = getLocalDateString();
  const stats = getHabitStats(habit);
  const card = createElement("article", "habit-card");

  const isScheduledToday = isHabitScheduled(habit, today);
  const isDoneToday = habit.completedDates.includes(today);
  const head = createElement("div", "habit-card__head");

  head.append(
    createElement("h3", "", habit.title),
    isScheduledToday
      ? createBadge(
          isDoneToday ? "Done today" : "Pending today",
          isDoneToday ? "success" : "warning",
        )
      : createBadge("Not scheduled today", "neutral"),
  );

  const description = createElement(
    "p",
    "habit-card__description",
    habit.description || "No description added.",
  );

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const scheduleText =
    habit.schedule === "daily"
      ? "Every day"
      : `Selected weekdays: ${habit.weekdays.map((day) => weekdayNames[day]).join(", ")}`;

  const meta = createElement("div", "habit-card__meta");

  meta.append(
    createBadge(scheduleText, "brand"),
    createBadge(
      `${habit.duration}-day plan · Started ${formatDisplayDate(habit.startDate)}`,
      "neutral",
    ),
  );

  const consistencyTrack = createProgressBar(
    `${habit.title} consistency`,
    stats.consistency,
    "progress-bar--sm",
  );

  const statsBox = createElement("div", "habit-stats");

  statsBox.append(
    createElement("p", "", `Consistency: ${stats.consistency}%`),
    createElement("p", "", `Completed days: ${stats.completedDays}`),
    createElement("p", "", `Missed days: ${stats.missedDays}`),
    createElement("p", "", `Current streak: ${pluralise(stats.currentStreak, "day")}`),
    createElement("p", "", `Best streak: ${pluralise(stats.bestStreak, "day")}`),
  );

  const lastPlanDate = addDays(habit.startDate, Number(habit.duration) - 1);
  const hasStarted = habit.startDate <= today;
  let selectedDate = today;

  if (!hasStarted) {
    selectedDate = habit.startDate;
  } else if (today > lastPlanDate) {
    selectedDate = lastPlanDate;
  }

  const datePicker = createElement("input", "habit-date-picker");

  datePicker.type = "date";
  datePicker.min = habit.startDate;
  datePicker.max = hasStarted
    ? (today < lastPlanDate ? today : lastPlanDate)
    : habit.startDate;
  datePicker.value = selectedDate;
  datePicker.disabled = !hasStarted;
  datePicker.setAttribute("aria-label", `Choose date for ${habit.title}`);

  const statusText = createElement("p", "habit-status");
  const completionButton = createButton("", "btn btn-primary habit-complete-button");

  function updateHabitDateStatus() {
    const isScheduled = isHabitScheduled(habit, selectedDate);
    const isCompleted = habit.completedDates.includes(selectedDate);
    const dateLabel =
      selectedDate === today ? "today" : `on ${formatDisplayDate(selectedDate)}`;

    statusText.className = "habit-status";
    completionButton.disabled = false;
    completionButton.className = "btn btn-primary habit-complete-button";

    if (selectedDate > today) {
      statusText.textContent = `Starts on ${formatDisplayDate(selectedDate)}`;
      completionButton.textContent = "Not Started Yet";
      completionButton.disabled = true;
    } else if (!isScheduled) {
      statusText.textContent = "Not scheduled on this date";
      completionButton.textContent = "Not Scheduled";
      completionButton.disabled = true;
    } else if (isCompleted) {
      statusText.textContent = `Completed ${dateLabel}`;
      statusText.classList.add("completed");
      completionButton.textContent = "Undo Completion";
      completionButton.className = "btn btn-soft habit-complete-button";
    } else {
      statusText.textContent =
        selectedDate === today ? "Pending today" : `Not completed ${dateLabel}`;
      statusText.classList.add("pending");
      completionButton.textContent =
        selectedDate === today ? "Mark Complete" : "Mark Complete for Selected Date";
    }
  }

  datePicker.addEventListener("change", function () {
    if (!datePicker.value) {
      datePicker.value = selectedDate;
      return;
    }

    selectedDate = datePicker.value;
    updateHabitDateStatus();
  });

  completionButton.addEventListener("click", function () {
    toggleHabitCompletion(habit.id, selectedDate);
  });

  updateHabitDateStatus();

  const actions = createElement("div", "habit-card__actions");

  actions.append(
    completionButton,
    createButton("Edit", "btn btn-soft btn-sm", {
      action: "edit",
      id: habit.id,
    }),
    createButton("Delete", "btn btn-danger btn-sm", {
      action: "delete",
      id: habit.id,
    }),
  );

  card.append(
    head,
    description,
    meta,
    createHabitWeek(habit),
    consistencyTrack,
    statsBox,
    datePicker,
    statusText,
    actions,
  );

  return card;
}

function renderHabits() {
  habitsList.innerHTML = "";

  const summary = getHabitsTodaySummary();

  totalHabits.textContent = habits.length;
  completedHabitsToday.textContent = summary.completed.length;
  habitsProgressPercent.textContent = `${summary.percent}%`;

  if (habits.length === 0) {
    habitsList.appendChild(
      createEmptyState(
        "No habits yet. Add your first habit to start building consistency.",
      ),
    );
    return;
  }

  habits.forEach((habit) => habitsList.appendChild(createHabitCard(habit)));
}

/* ---------- Form helpers ---------- */

function openHabitForm(habit = null) {
  habitForm.reset();
  editingHabitID = habit ? habit.id : null;

  habitFormHeading.textContent = habit ? "Edit Habit" : "Create a Habit";
  saveHabitButton.textContent = habit ? "Update Habit" : "Save Habit";

  if (habit) {
    habitTitle.value = habit.title;
    habitDescription.value = habit.description;
    habitStartDate.value = habit.startDate;
    habitDuration.value = String(habit.duration);

    habitScheduleOptions.forEach((option) => {
      option.checked = option.value === habit.schedule;
    });

    habitWeekdayOptions.forEach((option) => {
      option.checked = habit.weekdays.includes(Number(option.value));
    });
  } else {
    habitStartDate.value = getLocalDateString();
  }

  habitWeekdays.hidden = !(habit && habit.schedule === "selected-days");
  habitFormSection.hidden = false;
  habitFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
  habitTitle.focus({ preventScroll: true });
}

function closeHabitForm() {
  habitForm.reset();
  editingHabitID = null;
  habitFormSection.hidden = true;
  habitWeekdays.hidden = true;
}

/* ---------- Event listeners ---------- */

addHabitButton.addEventListener("click", function () {
  openHabitForm();
});

cancelHabitButton.addEventListener("click", closeHabitForm);

habitScheduleOptions.forEach((option) => {
  option.addEventListener("change", function () {
    const selectedSchedule = document.querySelector(
      'input[name="habit-schedule"]:checked',
    ).value;

    habitWeekdays.hidden = selectedSchedule !== "selected-days";
  });
});

habitForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = habitTitle.value.trim();
  const selectedSchedule = document.querySelector(
    'input[name="habit-schedule"]:checked',
  ).value;
  const weekdays = Array.from(habitWeekdayOptions)
    .filter((option) => option.checked)
    .map((option) => Number(option.value));

  if (!title) {
    alert("Please enter a habit name.");
    habitTitle.focus();
    return;
  }

  if (selectedSchedule === "selected-days" && weekdays.length === 0) {
    alert("Please select at least one weekday.");
    return;
  }

  const habitData = {
    title,
    description: habitDescription.value.trim(),
    startDate: habitStartDate.value,
    duration: Number(habitDuration.value),
    schedule: selectedSchedule,
    weekdays: selectedSchedule === "daily" ? [] : weekdays,
  };

  if (editingHabitID !== null) {
    const existingHabit = habits.find((habit) => habit.id === editingHabitID);

    if (existingHabit) {
      Object.assign(existingHabit, habitData);
    }
  } else {
    habits.push({ id: createId(), ...habitData, completedDates: [] });
  }

  closeHabitForm();
  commitHabits();
});

habitsList.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const habit = habits.find((item) => item.id === button.dataset.id);

  if (!habit) {
    return;
  }

  if (button.dataset.action === "edit") {
    openHabitForm(habit);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Delete "${habit.title}"? Its progress history will be removed.`,
    );

    if (!confirmed) {
      return;
    }

    if (editingHabitID === habit.id) {
      closeHabitForm();
    }

    habits = habits.filter((item) => item.id !== habit.id);
    commitHabits();
  }
});

/* ==========================================================================
   07. APP INITIALISATION
   ========================================================================== */

journalDate.value = getLocalDateString();

renderTaskList();
renderJournalEntries();
renderGoals();
renderHabits();
switchView("dashboard");

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    renderTaskList();
    renderGoals();
    renderHabits();
    renderDashboard();
  }
});
