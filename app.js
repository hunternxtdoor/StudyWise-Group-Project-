const themeSelect = document.getElementById("theme");
const currentTheme = localStorage.getItem("studyTheme") || "light";
document.documentElement.setAttribute("data-theme", currentTheme);
themeSelect.value = currentTheme;

themeSelect.addEventListener("change", (e) => {
  document.documentElement.setAttribute("data-theme", e.target.value);
  localStorage.setItem("studyTheme", e.target.value);
});

let timerInterval;
let timeLeft = 25 * 60;
let isRunning = false;
const timerDisplay = document.getElementById("timer-display");

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

document.getElementById("start-timer").addEventListener("click", () => {
  if (!isRunning) {
    isRunning = true;
    timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateTimer();
      } else {
        clearInterval(timerInterval);
        isRunning = false;
        alert("Time's up! Great study session.");
      }
    }, 1000);
  }
});

document.getElementById("pause-timer").addEventListener("click", () => {
  clearInterval(timerInterval);
  isRunning = false;
});

document.getElementById("reset-timer").addEventListener("click", () => {
  clearInterval(timerInterval);
  isRunning = false;
  timeLeft = 25 * 60;
  updateTimer();
});

let tasks = JSON.parse(localStorage.getItem("studyTasks")) || [];
let currentFilter = "all";
const taskList = document.getElementById("task-list");

function updateProgress() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  document.getElementById("total-tasks").textContent = total;
  document.getElementById("completed-tasks").textContent = completed;
  document.getElementById("pending-tasks").textContent = pending;
  document.getElementById("progress-bar").style.width = `${percentage}%`;
  document.getElementById("progress-text").textContent =
    `${percentage}% Completed`;
}

function renderTasks() {
  taskList.innerHTML = "";
  const filtered = tasks.filter((t) => {
    if (currentFilter === "completed") return t.completed;
    if (currentFilter === "pending") return !t.completed;
    return true;
  });

  filtered.forEach((task) => {
    const li = document.createElement("li");
    if (task.completed) li.classList.add("completed");
    li.innerHTML = `
            <div class="task-info">
                <strong class="task-text">${task.title}</strong>
                <span class="task-meta">${task.subject} | ${task.date}</span>
            </div>
            <div class="actions">
                <button onclick="toggleTask(${task.id})">${task.completed ? "↩️" : "✅"}</button>
                <button onclick="editTask(${task.id})">✏️</button>
                <button onclick="deleteTask(${task.id})">❌</button>
            </div>
        `;
    taskList.appendChild(li);
  });
  updateProgress();
  localStorage.setItem("studyTasks", JSON.stringify(tasks));
}

document.getElementById("task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  tasks.push({
    id: Date.now(),
    title: document.getElementById("task-title").value,
    subject: document.getElementById("task-subject").value,
    date: document.getElementById("task-date").value,
    completed: false,
  });
  e.target.reset();
  renderTasks();
});

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) task.completed = !task.completed;
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  renderTasks();
}

function editTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    document.getElementById("task-title").value = task.title;
    document.getElementById("task-subject").value = task.subject;
    document.getElementById("task-date").value = task.date;
    deleteTask(id);
  }
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentFilter = e.target.dataset.filter;
    renderTasks();
  });
});

let sessions = JSON.parse(localStorage.getItem("studySessions")) || [];
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function renderTimetable() {
  const container = document.getElementById("timetable-display");
  container.innerHTML = "";

  days.forEach((day) => {
    const daySessions = sessions
      .filter((s) => s.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (daySessions.length > 0) {
      const block = document.createElement("div");
      block.className = "day-block";
      block.innerHTML = `<h3>${day}</h3>`;

      daySessions.forEach((s) => {
        block.innerHTML += `
                    <div class="session">
                        <span>${s.time} - ${s.subject}</span>
                        <button class="btn-danger" style="padding: 2px 6px; font-size: 0.7rem;" onclick="deleteSession(${s.id})">X</button>
                    </div>`;
      });
      container.appendChild(block);
    }
  });
  localStorage.setItem("studySessions", JSON.stringify(sessions));
}

document.getElementById("timetable-form").addEventListener("submit", (e) => {
  e.preventDefault();
  sessions.push({
    id: Date.now(),
    day: document.getElementById("tt-day").value,
    subject: document.getElementById("tt-subject").value,
    time: document.getElementById("tt-time").value,
  });
  e.target.reset();
  renderTimetable();
});

function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  renderTimetable();
}

let notes = JSON.parse(localStorage.getItem("studyNotes")) || [];

function renderNotes() {
  const list = document.getElementById("note-list");
  list.innerHTML = "";
  notes.forEach((note) => {
    list.innerHTML += `
            <li>
                <span style="flex: 1; word-break: break-word;">${note.text}</span>
                <div class="actions">
                    <button onclick="editNote(${note.id})">✏️</button>
                    <button onclick="deleteNote(${note.id})">❌</button>
                </div>
            </li>`;
  });
  localStorage.setItem("studyNotes", JSON.stringify(notes));
}

document.getElementById("note-form").addEventListener("submit", (e) => {
  e.preventDefault();
  notes.push({
    id: Date.now(),
    text: document.getElementById("note-text").value,
  });
  e.target.reset();
  renderNotes();
});

function editNote(id) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    document.getElementById("note-text").value = note.text;
    deleteNote(id);
  }
}

function deleteNote(id) {
  notes = notes.filter((n) => n.id !== id);
  renderNotes();
}

renderTasks();
renderTimetable();
renderNotes();
// Development finished 6th June 2026