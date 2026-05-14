import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const DARK_THEMES = ["dark", "ocean", "forest", "sunset"];
const THEME_KEY = "studytime-theme";
const THEME_ICONS = {
  light: "☀️",
  dark: "🌙",
  ocean: "🌊",
  forest: "🌿",
  sunset: "🌅",
};

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = THEME_ICONS[theme] ?? "🎨";
  document
    .querySelectorAll(".swatch")
    .forEach((s) => s.classList.toggle("active", s.dataset.theme === theme));
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) ?? "light");
  document
    .querySelectorAll(".swatch")
    .forEach((s) =>
      s.addEventListener("click", () => applyTheme(s.dataset.theme)),
    );
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(DARK_THEMES.includes(cur) ? "light" : "dark");
  });
}

async function extractSubjectsFromPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str ?? "").join("\n") + "\n";
  }
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidates = lines.filter((line) => {
    if (line.length < 2 || line.length > 80) return false;
    if (/^\d+$/.test(line)) return false;
    return (line.match(/[a-zA-Z]/g) ?? []).length / line.length >= 0.4;
  });
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(c);
    }
  }
  const result = [...unique].sort((a, b) => a.length - b.length).slice(0, 20);
  return result.length > 0
    ? result
    : ["Mathematics", "English", "Science", "History", "Geography"];
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const TIME_SLOTS = [
  "6:00 PM \u2013 7:00 PM",
  "7:00 PM \u2013 8:00 PM",
  "8:00 PM \u2013 9:00 PM",
];
const SLOTS_PER_DAY = 3;
const LIGHT_DAY_INDEX = DAYS.indexOf("Saturday");
const FREQ = { hard: 5, medium: 3, easy: 2 };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureAllPresent(schedule, subjects) {
  const seen = new Set(
    schedule
      .flat()
      .filter(Boolean)
      .map((s) => s.name),
  );
  for (const sub of subjects) {
    if (seen.has(sub.name)) continue;
    for (let d = 0; d < DAYS.length; d++) {
      const names = schedule[d].filter(Boolean).map((s) => s.name);
      const emptyIdx = schedule[d].indexOf(null);
      if (emptyIdx !== -1 && !names.includes(sub.name)) {
        schedule[d][emptyIdx] = sub;
        seen.add(sub.name);
        break;
      }
    }
  }
}

function generateTimetable(subjects) {
  if (!subjects.length) return DAYS.map((day) => ({ day, slots: [] }));
  const schedule = DAYS.map(() => new Array(SLOTS_PER_DAY).fill(null));
  const count = {};
  subjects.forEach((s) => (count[s.name] = 0));

  for (let d = 0; d < DAYS.length; d++) {
    const isLight = d === LIGHT_DAY_INDEX;
    const maxSlots = isLight ? 2 : SLOTS_PER_DAY;
    const used = new Set();

    for (let s = 0; s < maxSlots; s++) {
      const prev = s > 0 ? schedule[d][s - 1] : null;
      const pick = shuffle(subjects).find((sub) => {
        if (used.has(sub.name)) return false;
        if (count[sub.name] >= FREQ[sub.difficulty]) return false;
        if (isLight && sub.difficulty === "hard") return false;
        if (prev?.difficulty === "hard" && sub.difficulty === "hard")
          return false;
        return true;
      });
      if (pick) {
        schedule[d][s] = pick;
        used.add(pick.name);
        count[pick.name]++;
      }
    }
  }
  ensureAllPresent(schedule, subjects);
  return DAYS.map((day, d) => ({
    day,
    slots: schedule[d]
      .map((sub, s) =>
        sub
          ? {
              subject: sub.name,
              difficulty: sub.difficulty,
              timeSlot: TIME_SLOTS[s],
            }
          : null,
      )
      .filter(Boolean),
  }));
}

const SAVES_KEY = "studytime-saves";

function getSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setSaves(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function saveTimetable(name, subjectList, timetableData) {
  const saves = getSaves();
  saves.unshift({
    id: Math.random().toString(36).slice(2, 9),
    name: name.trim() || "Untitled",
    savedAt: Date.now(),
    subjects: subjectList,
    timetable: timetableData,
  });
  setSaves(saves.slice(0, 20));
}

function deleteSave(id) {
  setSaves(getSaves().filter((s) => s.id !== id));
}

function formatDate(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

let subjects = [];
let timetable = null;

const uid = () => Math.random().toString(36).slice(2, 9);

function showToast(msg, type = "info") {
  const old = document.getElementById("_toast");
  if (old) old.remove();
  const t = document.createElement("div");
  t.id = "_toast";
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed",
    bottom: "1.5rem",
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "error" ? "#dc2626" : "#1e293b",
    color: "#fff",
    padding: ".55rem 1.25rem",
    borderRadius: "10px",
    fontSize: ".88rem",
    fontWeight: "600",
    zIndex: "9999",
    boxShadow: "0 4px 20px rgba(0,0,0,.3)",
    opacity: "1",
    transition: "opacity .35s",
    whiteSpace: "nowrap",
  });
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 380);
  }, 2600);
}

function goToStep(n) {
  [1, 2, 3].forEach((i) => {
    document
      .getElementById(`section-${i}`)
      ?.classList.toggle("hidden", i !== n);
    const dot = document.getElementById(`step-dot-${i}`);
    if (dot)
      dot.className =
        "step " + (i < n ? "done" : i === n ? "active" : "inactive");
  });
  document.getElementById("line-1")?.classList.toggle("filled", n > 1);
  document.getElementById("line-2")?.classList.toggle("filled", n > 2);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSavesBadge() {
  const count = getSaves().length;
  const badge = document.getElementById("saves-badge");
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
}

function renderSubjectList() {
  const list = document.getElementById("subject-list");
  list.innerHTML = "";
  subjects.forEach((sub, idx) => {
    const li = document.createElement("li");
    li.className = "subject-item";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "subject-input";
    inp.placeholder = `Subject ${idx + 1}`;
    inp.value = sub.name;
    inp.addEventListener("input", () => {
      subjects[idx].name = inp.value;
    });
    const del = document.createElement("button");
    del.className = "remove-btn";
    del.title = "Remove";
    del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    del.addEventListener("click", () => {
      subjects.splice(idx, 1);
      renderSubjectList();
    });
    li.appendChild(inp);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function renderDifficultyList() {
  const list = document.getElementById("difficulty-list");
  list.innerHTML = "";
  subjects.forEach((sub, idx) => {
    const li = document.createElement("li");
    li.className = "diff-item";
    const nameDiv = document.createElement("div");
    nameDiv.className = "diff-name";
    const avatar = document.createElement("div");
    avatar.className = "diff-avatar";
    avatar.textContent = (sub.name || "?").charAt(0).toUpperCase();
    const label = document.createElement("span");
    label.textContent = sub.name || `Subject ${idx + 1}`;
    nameDiv.appendChild(avatar);
    nameDiv.appendChild(label);
    const group = document.createElement("div");
    group.className = "diff-btns";
    ["easy", "medium", "hard"].forEach((level) => {
      const btn = document.createElement("button");
      btn.className = "diff-btn";
      btn.textContent = level.charAt(0).toUpperCase() + level.slice(1);
      if (sub.difficulty === level) btn.classList.add(`active-${level}`);
      btn.addEventListener("click", () => {
        subjects[idx].difficulty = level;
        group
          .querySelectorAll(".diff-btn")
          .forEach((b) =>
            b.classList.remove("active-easy", "active-medium", "active-hard"),
          );
        btn.classList.add(`active-${level}`);
      });
      group.appendChild(btn);
    });
    li.appendChild(nameDiv);
    li.appendChild(group);
    list.appendChild(li);
  });
}

function renderTimetable() {
  const table = document.getElementById("timetable");
  table.innerHTML = "";
  const thead = table.createTHead();
  const hrow = thead.insertRow();
  const thTime = document.createElement("th");
  thTime.textContent = "Time";
  hrow.appendChild(thTime);
  DAYS.forEach((day) => {
    const th = document.createElement("th");
    th.textContent = day;
    hrow.appendChild(th);
  });
  const tbody = table.createTBody();
  TIME_SLOTS.forEach((slot) => {
    const tr = tbody.insertRow();
    const tdTime = tr.insertCell();
    tdTime.textContent = slot;
    DAYS.forEach((day) => {
      const dayData = timetable.find((d) => d.day === day);
      const slotData = dayData?.slots.find((s) => s.timeSlot === slot);
      const td = tr.insertCell();
      if (slotData) {
        td.className = `cell-${slotData.difficulty}`;
        td.textContent = slotData.subject;
      } else {
        td.innerHTML = `<span class="cell-empty">–</span>`;
      }
    });
  });
}

function renderSavesModal() {
  const body = document.getElementById("saves-list");
  const saves = getSaves();
  body.innerHTML = "";

  if (saves.length === 0) {
    body.innerHTML = `
      <div class="empty-saves">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <p>No saved timetables yet.</p>
        <p>Generate a timetable and hit <strong>Save</strong> to store it here.</p>
      </div>`;
    return;
  }

  saves.forEach((save) => {
    const card = document.createElement("div");
    card.className = "save-card";

    const info = document.createElement("div");
    info.className = "save-card-info";

    const name = document.createElement("div");
    name.className = "save-card-name";
    name.textContent = save.name;

    const subjectNames = save.subjects
      .map((s) => s.name)
      .slice(0, 3)
      .join(", ");
    const more =
      save.subjects.length > 3 ? ` +${save.subjects.length - 3} more` : "";
    const meta = document.createElement("div");
    meta.className = "save-card-meta";
    meta.textContent = `${subjectNames}${more}  ·  ${formatDate(save.savedAt)}`;

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "save-card-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn-load";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      subjects = save.subjects.map((s) => ({ ...s, id: uid() }));
      timetable = save.timetable;
      renderSubjectList();
      renderTimetable();
      closeSavesModal();
      goToStep(3);
      showToast(`Loaded "${save.name}"`);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn-del";
    delBtn.title = "Delete";
    delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    delBtn.addEventListener("click", () => {
      deleteSave(save.id);
      updateSavesBadge();
      renderSavesModal();
      showToast("Timetable deleted.");
    });

    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(actions);
    body.appendChild(card);
  });
}

function openSavesModal() {
  renderSavesModal();
  document.getElementById("saves-overlay").classList.remove("hidden");
}

function closeSavesModal() {
  document.getElementById("saves-overlay").classList.add("hidden");
}

function init() {
  initTheme();
  updateSavesBadge();

  const zone = document.getElementById("upload-zone");
  const input = document.getElementById("pdf-input");
  const icon = document.getElementById("upload-icon");
  const title = document.getElementById("upload-title");

  const ICON_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.style.borderColor = "var(--primary)";
  });
  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "";
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.style.borderColor = "";
    handlePdf(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => {
    handlePdf(input.files[0]);
    input.value = "";
  });

  async function handlePdf(file) {
    if (!file) return;
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      showToast("Please upload a PDF file.", "error");
      return;
    }
    icon.innerHTML = `<div class="spinner"></div>`;
    title.textContent = "Reading PDF…";
    try {
      const extracted = await extractSubjectsFromPdf(file);
      const existing = new Set(subjects.map((s) => s.name.toLowerCase()));
      const newOnes = extracted
        .filter((n) => !existing.has(n.toLowerCase()))
        .map((name) => ({ id: uid(), name, difficulty: undefined }));
      subjects.push(...newOnes);
      renderSubjectList();
      showToast(
        `${newOnes.length} subject${newOnes.length !== 1 ? "s" : ""} extracted.`,
      );
    } catch (err) {
      console.error(err);
      showToast("Could not read PDF. Enter subjects manually.", "error");
    } finally {
      icon.innerHTML = ICON_SVG;
      title.textContent = "Click or drag a PDF here";
    }
  }

  document
    .getElementById("open-saves-btn")
    .addEventListener("click", openSavesModal);
  document
    .getElementById("saves-close")
    .addEventListener("click", closeSavesModal);
  document.getElementById("saves-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSavesModal();
  });

  document.getElementById("add-subject-btn").addEventListener("click", () => {
    subjects.push({ id: uid(), name: "", difficulty: undefined });
    renderSubjectList();
    const inputs = document.querySelectorAll(".subject-input");
    inputs[inputs.length - 1]?.focus();
  });

  document.getElementById("next-to-2").addEventListener("click", () => {
    document.querySelectorAll(".subject-input").forEach((inp, i) => {
      if (subjects[i]) subjects[i].name = inp.value;
    });
    const valid = subjects.filter((s) => s.name.trim());
    if (!valid.length) {
      showToast("Add at least one subject.", "error");
      return;
    }
    subjects = valid;
    renderDifficultyList();
    goToStep(2);
  });

  document.getElementById("back-to-1").addEventListener("click", () => {
    renderSubjectList();
    goToStep(1);
  });

  function runGenerate() {
    if (subjects.some((s) => !s.difficulty)) {
      showToast("Assign a difficulty to every subject first.", "error");
      return;
    }
    timetable = generateTimetable(subjects);
    renderTimetable();
    goToStep(3);
  }

  document
    .getElementById("generate-btn")
    .addEventListener("click", runGenerate);

  document.getElementById("regen-btn").addEventListener("click", () => {
    timetable = generateTimetable(subjects);
    renderTimetable();
    showToast("Timetable regenerated!");
  });

  const savePopover = document.getElementById("save-popover");
  const saveNameInp = document.getElementById("save-name-input");

  document.getElementById("save-btn").addEventListener("click", () => {
    saveNameInp.value = "";
    savePopover.classList.toggle("hidden");
    if (!savePopover.classList.contains("hidden")) saveNameInp.focus();
  });

  document.getElementById("save-cancel-btn").addEventListener("click", () => {
    savePopover.classList.add("hidden");
  });

  document.getElementById("save-confirm-btn").addEventListener("click", () => {
    if (!timetable) return;
    const name = saveNameInp.value.trim() || "Untitled";
    saveTimetable(name, subjects, timetable);
    updateSavesBadge();
    savePopover.classList.add("hidden");
    showToast(`Saved as "${name}"!`);
  });

  saveNameInp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save-confirm-btn").click();
    if (e.key === "Escape") savePopover.classList.add("hidden");
  });

  document
    .getElementById("download-btn")
    .addEventListener("click", () => window.print());

  document.getElementById("start-over-btn").addEventListener("click", () => {
    subjects = [];
    timetable = null;
    savePopover.classList.add("hidden");
    renderSubjectList();
    goToStep(1);
  });
}

document.addEventListener("DOMContentLoaded", init);
