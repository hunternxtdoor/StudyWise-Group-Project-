// ==========================
// IMPORTS
// ==========================
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

// ==========================
// GLOBAL STATE
// ==========================
const state = {
  subjects: [],
  timetable: null,
};

// ==========================
// CONSTANTS
// ==========================
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIME_SLOTS = ["6–7 PM","7–8 PM","8–9 PM"];
const SLOTS_PER_DAY = 3;

// ==========================
// THEME SYSTEM
// ==========================
const THEME_KEY = "studytime-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
}

// ==========================
// PDF EXTRACTION
// ==========================
async function extractSubjectsFromPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join("\n");
  }

  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 2 && /[a-zA-Z]/.test(l))
    .slice(0, 20);
}

// ==========================
// SMART ALGORITHM
// ==========================
function generateTimetable(subjects) {
  const schedule = DAYS.map(() => new Array(SLOTS_PER_DAY).fill(null));
  const lastSeen = {};

  subjects.forEach(s => lastSeen[s.name] = -10);

  for (let d = 0; d < DAYS.length; d++) {
    for (let s = 0; s < SLOTS_PER_DAY; s++) {

      let best = null;
      let bestScore = -Infinity;

      for (const sub of subjects) {
        let score = 0;

        // PRIORITY
        const priority = { hard: 3, medium: 2, easy: 1 };
        score += priority[sub.difficulty] * 2;

        // SPACING
        score += (d - lastSeen[sub.name]) * 2;

        // URGENCY (optional)
        score += (sub.urgency || 1) * 3;

        // SAME DAY PENALTY
        if (schedule[d].some(x => x?.name === sub.name)) {
          score -= 6;
        }

        // HARD STACKING PENALTY
        const prev = s > 0 ? schedule[d][s - 1] : null;
        if (prev?.difficulty === "hard" && sub.difficulty === "hard") {
          score -= 5;
        }

        // FATIGUE PENALTY
        if (s === 2 && sub.difficulty === "hard") {
          score -= 4;
        }

        // LIGHT DAY
        if (DAYS[d] === "Saturday" && sub.difficulty === "hard") {
          score -= 8;
        }

        if (score > bestScore) {
          bestScore = score;
          best = sub;
        }
      }

      if (best) {
        schedule[d][s] = best;
        lastSeen[best.name] = d;
      }
    }
  }

  return schedule;
}

// ==========================
// RENDERING
// ==========================
function renderSubjects() {
  const list = document.getElementById("subject-list");
  list.innerHTML = "";

  state.subjects.forEach((sub, i) => {
    const li = document.createElement("li");

    const input = document.createElement("input");
    input.value = sub.name;
    input.oninput = () => state.subjects[i].name = input.value;

    li.appendChild(input);
    list.appendChild(li);
  });
}

function renderTimetable() {
  const table = document.getElementById("timetable");
  table.innerHTML = "";

  const header = table.insertRow();
  header.insertCell().textContent = "Time";

  DAYS.forEach(day => {
    header.insertCell().textContent = day;
  });

  TIME_SLOTS.forEach((slot, i) => {
    const row = table.insertRow();
    row.insertCell().textContent = slot;

    DAYS.forEach((day, d) => {
      const cell = row.insertCell();
      const sub = state.timetable[d][i];

      if (sub) {
        cell.textContent = sub.name;
      }
    });
  });
}

// ==========================
// UI HANDLERS
// ==========================
function addSubject() {
  state.subjects.push({
    name: "",
    difficulty: "medium",
    urgency: 1
  });
  renderSubjects();
}

function generate() {
  if (!state.subjects.length) {
    alert("Add subjects first");
    return;
  }

  state.timetable = generateTimetable(state.subjects);
  renderTimetable();
}

// ==========================
// INIT
// ==========================
function init() {
  initTheme();

  document.getElementById("add-subject-btn").onclick = addSubject;
  document.getElementById("generate-btn").onclick = generate;

  document.getElementById("pdf-input").onchange = async (e) => {
    const names = await extractSubjectsFromPdf(e.target.files[0]);

    names.forEach(n => {
      state.subjects.push({
        name: n,
        difficulty: "medium",
        urgency: 1
      });
    });

    renderSubjects();
  };
}

document.addEventListener("DOMContentLoaded", init);