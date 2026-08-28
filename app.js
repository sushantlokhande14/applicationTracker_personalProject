"use strict";

const STORAGE_KEY = "application-tracker.entries.v1";

const STAGES = ["Wishlist", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];

const els = {
  body: document.body,
  todayLabel: document.querySelector("#today-label"),
  addButton: document.querySelector("#add-application"),
  emptyAdd: document.querySelector("#empty-add"),
  dialog: document.querySelector("#application-dialog"),
  form: document.querySelector("#application-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelDialog: document.querySelector("#cancel-dialog"),
  id: document.querySelector("#application-id"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  lastSaved: document.querySelector("#last-saved"),
  toast: document.querySelector("#toast"),
};

let applications = readApplications();

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

function render() {
  const isEmpty = applications.length === 0;
  els.emptyState.hidden = !isEmpty;
  els.resultCount.textContent = `${applications.length} application${applications.length === 1 ? "" : "s"}`;
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

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

els.todayLabel.textContent = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

[els.addButton, els.emptyAdd].forEach((button) => button.addEventListener("click", () => openDialog()));

[els.closeDialog, els.cancelDialog].forEach((button) => button.addEventListener("click", closeDialog));

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

els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) closeDialog();
});

render();
