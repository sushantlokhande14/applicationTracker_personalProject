"use strict";

const STORAGE_KEY = "application-tracker.entries.v1";
const THEME_KEY = "application-tracker.theme";
const STAGES = ["Wishlist", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];

const els = {
  body: document.body,
  pageTitle: document.querySelector("#page-title"),
  todayLabel: document.querySelector("#today-label"),
  addButton: document.querySelector("#add-application"),
  emptyAdd: document.querySelector("#empty-add"),
  emptyDemo: document.querySelector("#empty-demo"),
  dialog: document.querySelector("#application-dialog"),
  form: document.querySelector("#application-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelDialog: document.querySelector("#cancel-dialog"),
  deleteButton: document.querySelector("#delete-application"),
  id: document.querySelector("#application-id"),
  tableBody: document.querySelector("#application-table-body"),
  tableView: document.querySelector("#table-view"),
  boardView: document.querySelector("#board-view"),
  emptyState: document.querySelector("#empty-state"),
  search: document.querySelector("#search-input"),
  priorityFilter: document.querySelector("#priority-filter"),
  sort: document.querySelector("#sort-select"),
  resultCount: document.querySelector("#result-count"),
  lastSaved: document.querySelector("#last-saved"),
  moreButton: document.querySelector("#more-menu-button"),
  moreMenu: document.querySelector("#more-menu"),
  exportCsv: document.querySelector("#export-csv"),
  importCsv: document.querySelector("#import-csv"),
  csvFile: document.querySelector("#csv-file"),
  loadDemo: document.querySelector("#load-demo"),
  clearData: document.querySelector("#clear-data"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeIcon: document.querySelector("#theme-icon"),
  themeLabel: document.querySelector("#theme-label"),
  toast: document.querySelector("#toast"),
  metricTotal: document.querySelector("#metric-total"),
  metricThisWeek: document.querySelector("#metric-this-week"),
  metricInterviews: document.querySelector("#metric-interviews"),
  metricUpcoming: document.querySelector("#metric-upcoming"),
  metricOffers: document.querySelector("#metric-offers"),
  metricResponse: document.querySelector("#metric-response"),
};

let applications = readApplications();
let activeStage = "All";
let currentView = "table";
let toastTimer;

function readApplications() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveApplications(message = "Changes saved") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  const now = new Date();
  els.lastSaved.textContent = `Saved ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  render();
  if (message) showToast(message);
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, fallback = "—") {
  const date = parseDate(value);
  return date ? date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : fallback;
}

function daysUntil(value) {
  const target = parseDate(value);
  if (!target) return null;
  const today = parseDate(localDateValue());
  return Math.round((target - today) / 86_400_000);
}

function deadlineLabel(value) {
  const days = daysUntil(value);
  if (days === null) return { text: "No deadline", overdue: false };
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  if (days <= 7) return { text: `Due in ${days} days`, overdue: false };
  return { text: formatDate(value), overdue: false };
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = String(value);
  return node.innerHTML;
}

function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function avatarGradient(company) {
  const palettes = [
    ["#7a68ed", "#513bc2"],
    ["#2e9f89", "#187263"],
    ["#e28b48", "#bd5d31"],
    ["#4f8ce8", "#3c5db8"],
    ["#d95c7b", "#9d3551"],
    ["#8058bb", "#573584"],
  ];
  const score = [...String(company)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [start, end] = palettes[score % palettes.length];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

function statusClass(status) {
  return `status-${String(status).toLowerCase()}`;
}

function getFilteredApplications() {
  const query = els.search.value.trim().toLowerCase();
  const priority = els.priorityFilter.value;

  const filtered = applications.filter((item) => {
    const stageMatches = activeStage === "All" || item.status === activeStage;
    const priorityMatches = priority === "All" || item.priority === priority;
    const haystack = [item.company, item.role, item.location, item.contact, item.notes, item.nextAction]
      .join(" ")
      .toLowerCase();
    return stageMatches && priorityMatches && (!query || haystack.includes(query));
  });

  return filtered.sort((a, b) => {
    switch (els.sort.value) {
      case "date-desc":
        return (b.dateApplied || "").localeCompare(a.dateApplied || "");
      case "deadline-asc": {
        const aDate = a.deadline || "9999-12-31";
        const bDate = b.deadline || "9999-12-31";
        return aDate.localeCompare(bDate);
      }
      case "company-asc":
        return a.company.localeCompare(b.company);
      default:
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    }
  });
}

function render() {
  updateCounts();
  updateMetrics();
  const filtered = getFilteredApplications();
  renderTable(filtered);
  renderBoard(filtered);

  const isEmpty = filtered.length === 0;
  els.emptyState.hidden = !isEmpty;
  els.tableView.hidden = isEmpty || currentView !== "table";
  els.boardView.hidden = isEmpty || currentView !== "board";
  els.resultCount.textContent = `${filtered.length} application${filtered.length === 1 ? "" : "s"}`;
}

function updateCounts() {
  document.querySelector("#count-all").textContent = applications.length;
  STAGES.forEach((stage) => {
    const id = `#count-${stage.toLowerCase()}`;
    document.querySelector(id).textContent = applications.filter((item) => item.status === stage).length;
  });
}

function updateMetrics() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = applications.filter((item) => {
    const date = parseDate(item.dateApplied);
    return date && date >= weekAgo;
  }).length;
  const interviews = applications.filter((item) => item.status === "Interview").length;
  const offers = applications.filter((item) => item.status === "Offer").length;
  const appliedPool = applications.filter((item) => item.status !== "Wishlist").length;
  const responses = applications.filter((item) => ["Assessment", "Interview", "Offer"].includes(item.status)).length;
  const responseRate = appliedPool ? Math.round((responses / appliedPool) * 100) : 0;
  const upcoming = applications
    .map((item) => daysUntil(item.deadline))
    .filter((days) => days !== null && days >= 0)
    .sort((a, b) => a - b)[0];

  els.metricTotal.textContent = applications.length;
  els.metricThisWeek.textContent = `${thisWeek} added this week`;
  els.metricInterviews.textContent = interviews;
  els.metricOffers.textContent = offers;
  els.metricResponse.textContent = `${responseRate}%`;
  els.metricUpcoming.textContent = upcoming === undefined
    ? "No upcoming deadlines"
    : upcoming === 0 ? "Deadline today" : `Next deadline in ${upcoming} day${upcoming === 1 ? "" : "s"}`;
}

function renderTable(items) {
  els.tableBody.innerHTML = items.map((item) => {
    const deadline = deadlineLabel(item.deadline);
    const companyInitial = escapeHtml(item.company.trim().charAt(0).toUpperCase() || "?");
    const url = safeUrl(item.jobUrl);
    const companyContent = `
      <div class="company-avatar" style="background:${avatarGradient(item.company)}">${companyInitial}</div>
      <div class="company-copy">
        <strong>${escapeHtml(item.company)}</strong>
        <span>${escapeHtml(item.role)}${item.location ? ` · ${escapeHtml(item.location)}` : ""}</span>
      </div>`;
    return `
      <tr data-id="${escapeHtml(item.id)}">
        <td>${url
          ? `<a class="company-link company-cell" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${companyContent}</a>`
          : `<div class="company-cell">${companyContent}</div>`}
        </td>
        <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td class="date-cell">${formatDate(item.dateApplied)}</td>
        <td class="action-cell">
          <strong>${escapeHtml(item.nextAction || "No next action")}</strong>
          <span class="deadline ${deadline.overdue ? "overdue" : ""}">${escapeHtml(deadline.text)}</span>
        </td>
        <td><span class="priority-pill priority-${escapeHtml(item.priority.toLowerCase())}">${escapeHtml(item.priority)}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-button row-menu-button" type="button" aria-label="Actions for ${escapeHtml(item.company)}" aria-expanded="false">•••</button>
            <div class="row-menu" hidden>
              <button data-action="edit" type="button">Edit</button>
              <button data-action="duplicate" type="button">Duplicate</button>
              <button data-action="delete" type="button">Delete</button>
            </div>
          </div>
        </td>
      </tr>`;
  }).join("");
}

function renderBoard(items) {
  els.boardView.innerHTML = STAGES.map((stage) => {
    const stageItems = items.filter((item) => item.status === stage);
    const cards = stageItems.map((item) => {
      const deadline = deadlineLabel(item.deadline);
      return `
        <article class="board-card" data-id="${escapeHtml(item.id)}" tabindex="0">
          <div class="board-card-top">
            <div class="company-avatar" style="background:${avatarGradient(item.company)}">${escapeHtml(item.company.charAt(0).toUpperCase())}</div>
            <span class="priority-pill priority-${escapeHtml(item.priority.toLowerCase())}">${escapeHtml(item.priority)}</span>
          </div>
          <h4>${escapeHtml(item.company)}</h4>
          <span class="role">${escapeHtml(item.role)}</span>
          <div class="board-card-meta">
            <span>${escapeHtml(item.nextAction || "No next action")}</span>
            <span class="${deadline.overdue ? "deadline overdue" : ""}">${escapeHtml(deadline.text)}</span>
          </div>
        </article>`;
    }).join("");
    return `
      <section class="board-column">
        <div class="board-column-header"><h3>${escapeHtml(stage)}</h3><span>${stageItems.length}</span></div>
        <div class="board-list">${cards || '<div class="board-empty">No applications</div>'}</div>
      </section>`;
  }).join("");
}

function openDialog(item = null) {
  els.form.reset();
  els.id.value = item?.id || "";
  els.dialogTitle.textContent = item ? "Edit application" : "Add application";
  els.deleteButton.hidden = !item;

  const defaults = {
    company: "",
    role: "",
    status: "Applied",
    priority: "Medium",
    dateApplied: localDateValue(),
    deadline: "",
    nextAction: "",
    location: "",
    workMode: "",
    jobUrl: "",
    contact: "",
    compensation: "",
    notes: "",
    ...item,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const field = els.form.elements.namedItem(key);
    if (field) field.value = value ?? "";
  });

  els.dialog.showModal();
  requestAnimationFrame(() => document.querySelector("#company").focus());
}

function closeDialog() {
  els.dialog.close();
}

function formToApplication() {
  const data = new FormData(els.form);
  const now = new Date().toISOString();
  const existing = applications.find((item) => item.id === els.id.value);
  return {
    id: els.id.value || uid(),
    company: String(data.get("company") || "").trim(),
    role: String(data.get("role") || "").trim(),
    status: String(data.get("status") || "Applied"),
    priority: String(data.get("priority") || "Medium"),
    dateApplied: String(data.get("dateApplied") || ""),
    deadline: String(data.get("deadline") || ""),
    nextAction: String(data.get("nextAction") || "").trim(),
    location: String(data.get("location") || "").trim(),
    workMode: String(data.get("workMode") || ""),
    jobUrl: String(data.get("jobUrl") || "").trim(),
    contact: String(data.get("contact") || "").trim(),
    compensation: String(data.get("compensation") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function deleteApplication(id) {
  const item = applications.find((entry) => entry.id === id);
  if (!item || !confirm(`Delete the ${item.role} application at ${item.company}?`)) return;
  applications = applications.filter((entry) => entry.id !== id);
  if (els.dialog.open) closeDialog();
  saveApplications("Application deleted");
}

function duplicateApplication(id) {
  const item = applications.find((entry) => entry.id === id);
  if (!item) return;
  const now = new Date().toISOString();
  applications.unshift({ ...item, id: uid(), company: `${item.company} (copy)`, createdAt: now, updatedAt: now });
  saveApplications("Application duplicated");
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function closeMenus() {
  els.moreMenu.hidden = true;
  els.moreButton.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".row-menu").forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll(".row-menu-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  if (!applications.length) {
    showToast("Add an application before exporting");
    return;
  }
  const fields = ["company", "role", "status", "priority", "dateApplied", "deadline", "nextAction", "location", "workMode", "jobUrl", "contact", "compensation", "notes"];
  const rows = [fields.join(","), ...applications.map((item) => fields.map((field) => csvEscape(item[field])).join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `application-tracker-${localDateValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  closeMenus();
  showToast("CSV backup downloaded");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

async function importCsv(file) {
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("The CSV has no application rows.");
    const headers = rows[0].map((header) => header.trim());
    if (!headers.includes("company") || !headers.includes("role")) {
      throw new Error("The CSV must include company and role columns.");
    }
    const now = new Date().toISOString();
    const imported = rows.slice(1).map((row) => {
      const raw = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
      return {
        id: uid(),
        company: raw.company.trim(),
        role: raw.role.trim(),
        status: STAGES.includes(raw.status) ? raw.status : "Applied",
        priority: ["High", "Medium", "Low"].includes(raw.priority) ? raw.priority : "Medium",
        dateApplied: raw.dateApplied || "",
        deadline: raw.deadline || "",
        nextAction: raw.nextAction || "",
        location: raw.location || "",
        workMode: raw.workMode || "",
        jobUrl: raw.jobUrl || "",
        contact: raw.contact || "",
        compensation: raw.compensation || "",
        notes: raw.notes || "",
        createdAt: now,
        updatedAt: now,
      };
    }).filter((item) => item.company && item.role);
    applications = [...imported, ...applications];
    saveApplications(`${imported.length} application${imported.length === 1 ? "" : "s"} imported`);
  } catch (error) {
    showToast(error.message || "Could not import that CSV");
  } finally {
    els.csvFile.value = "";
  }
}

function demoData() {
  const today = new Date();
  const dateOffset = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return localDateValue(date);
  };
  const now = new Date().toISOString();
  return [
    {
      id: uid(), company: "Cloudflare", role: "Software Engineer, Realtime", status: "Interview", priority: "High",
      dateApplied: dateOffset(-12), deadline: dateOffset(2), nextAction: "Prepare system design stories", location: "New York, NY",
      workMode: "Hybrid", jobUrl: "", contact: "Recruiting team", compensation: "$150k–$190k", notes: "Review WebRTC, QUIC, and Media over QUIC fundamentals.", createdAt: now, updatedAt: now,
    },
    {
      id: uid(), company: "Vercel", role: "Backend Engineer", status: "Applied", priority: "High",
      dateApplied: dateOffset(-4), deadline: dateOffset(3), nextAction: "Follow up with recruiter", location: "Remote",
      workMode: "Remote", jobUrl: "", contact: "", compensation: "", notes: "Applied through company portal.", createdAt: now, updatedAt: now,
    },
    {
      id: uid(), company: "Datadog", role: "Software Engineer — Streaming", status: "Assessment", priority: "Medium",
      dateApplied: dateOffset(-8), deadline: dateOffset(1), nextAction: "Complete coding assessment", location: "Boston, MA",
      workMode: "Hybrid", jobUrl: "", contact: "", compensation: "", notes: "", createdAt: now, updatedAt: now,
    },
    {
      id: uid(), company: "Figma", role: "Software Engineer, Infrastructure", status: "Wishlist", priority: "Medium",
      dateApplied: "", deadline: "", nextAction: "Request referral", location: "San Francisco, CA",
      workMode: "Hybrid", jobUrl: "", contact: "", compensation: "", notes: "Tailor resume before applying.", createdAt: now, updatedAt: now,
    },
  ];
}

function loadDemoData() {
  if (applications.length && !confirm("Add demo applications to your existing tracker?")) return;
  applications = [...demoData(), ...applications];
  saveApplications("Demo applications added");
  closeMenus();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
  els.themeLabel.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem(THEME_KEY, theme);
}

els.todayLabel.textContent = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

[els.addButton, els.emptyAdd].forEach((button) => button.addEventListener("click", () => openDialog()));
[els.closeDialog, els.cancelDialog].forEach((button) => button.addEventListener("click", closeDialog));
[els.emptyDemo, els.loadDemo].forEach((button) => button.addEventListener("click", loadDemoData));

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!els.form.reportValidity()) return;
  const item = formToApplication();
  const index = applications.findIndex((entry) => entry.id === item.id);
  if (index >= 0) applications[index] = item;
  else applications.unshift(item);
  closeDialog();
  saveApplications(index >= 0 ? "Application updated" : "Application added");
});

els.deleteButton.addEventListener("click", () => deleteApplication(els.id.value));

document.querySelectorAll(".stage-filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeStage = button.dataset.stage;
    document.querySelectorAll(".stage-filter").forEach((item) => item.classList.toggle("active", item === button));
    els.pageTitle.textContent = activeStage === "All" ? "Your pipeline" : activeStage;
    render();
  });
});

document.querySelectorAll(".view-tab").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll(".view-tab").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    render();
  });
});

[els.search, els.priorityFilter, els.sort].forEach((control) => control.addEventListener("input", render));

els.moreButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = els.moreMenu.hidden;
  closeMenus();
  els.moreMenu.hidden = !willOpen;
  els.moreButton.setAttribute("aria-expanded", String(willOpen));
});

els.tableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const id = row.dataset.id;
  const menuButton = event.target.closest(".row-menu-button");
  if (menuButton) {
    event.stopPropagation();
    const menu = row.querySelector(".row-menu");
    const willOpen = menu.hidden;
    closeMenus();
    menu.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "edit") openDialog(applications.find((item) => item.id === id));
  if (action === "duplicate") duplicateApplication(id);
  if (action === "delete") deleteApplication(id);
});

els.boardView.addEventListener("click", (event) => {
  const card = event.target.closest(".board-card[data-id]");
  if (card) openDialog(applications.find((item) => item.id === card.dataset.id));
});

els.boardView.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".board-card[data-id]");
  if (card) {
    event.preventDefault();
    openDialog(applications.find((item) => item.id === card.dataset.id));
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-wrap") && !event.target.closest(".row-actions")) closeMenus();
});

els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) closeDialog();
});

els.exportCsv.addEventListener("click", exportCsv);
els.importCsv.addEventListener("click", () => { closeMenus(); els.csvFile.click(); });
els.csvFile.addEventListener("change", () => {
  const [file] = els.csvFile.files;
  if (file) importCsv(file);
});

els.clearData.addEventListener("click", () => {
  if (!applications.length) {
    showToast("The tracker is already empty");
    return;
  }
  if (!confirm("Clear every application? Export a CSV first if you want a backup.")) return;
  applications = [];
  saveApplications("All applications cleared");
  closeMenus();
});

els.themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

render();
