import { axes, isScore, parseScore, rankReceipt } from "./receipt.mjs";
import { copy } from "./copy.mjs";
import { renderPage } from "./view.mjs";

const root = document.querySelector("#b2c");
if (root instanceof HTMLElement) mount(root);

/** @param {HTMLElement} root */
function mount(root) {
  /** @type {import("./view.mjs").Locale} */
  let locale = document.documentElement.lang === "ko" ? "ko" : "en";
  /** @type {import("./view.mjs").Draft} */
  let draft = {};
  /** @type {import("./view.mjs").Receipt | null} */
  let receipt = null;
  render();

  function render() {
    document.documentElement.lang = locale;
    document.title = copy[locale].title + " | unstandard";
    root.innerHTML = renderPage(locale, draft, receipt, true);
  }

  function readDraft() {
    /** @type {import("./view.mjs").Draft} */
    const current = {};
    /** @type {HTMLSelectElement | null} */
    let firstInvalid = null;
    for (const axis of axes) {
      const field = root.querySelector("#score-" + axis);
      if (!(field instanceof HTMLSelectElement)) continue;
      const score = parseScore(field.value);
      if (isScore(score)) current[axis] = score;
      else firstInvalid ??= field;
    }
    draft = current;
    return firstInvalid;
  }

  root.addEventListener("change", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLSelectElement)) return;
    const invalid = readDraft();
    const progress = root.querySelector("#progress");
    if (progress) progress.textContent = copy[locale].progress(Object.keys(draft).length);
    if (isScore(parseScore(field.value))) field.removeAttribute("aria-invalid");
    const error = root.querySelector("#error");
    if (error && !invalid) error.textContent = "";
  });

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    switch (button.dataset.action) {
      case "language": {
        const hadError = Boolean(root.querySelector("#error")?.textContent);
        locale = locale === "en" ? "ko" : "en";
        render();
        if (hadError) showError(readDraft(), false);
        focusTarget("button[data-action=language]");
        break;
      }
      case "receipt": {
        const invalid = readDraft();
        try {
          receipt = rankReceipt(draft);
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
          showError(invalid, true);
          return;
        }
        render();
        focusTarget("#quiz");
        break;
      }
      case "edit":
        receipt = null;
        render();
        focusTarget("#quiz");
        break;
    }
  });

  /** @param {string} selector */
  function focusTarget(selector) {
    const target = root.querySelector(selector);
    if (target instanceof HTMLElement) target.focus();
  }

  // Clear restored in-memory answers when returning from another document.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    draft = {};
    receipt = null;
    render();
  });

  /** @param {HTMLSelectElement | null} field @param {boolean} focus */
  function showError(field, focus) {
    const error = root.querySelector("#error");
    if (error) error.textContent = copy[locale].error;
    field?.setAttribute("aria-invalid", "true");
    if (focus) field?.focus();
  }
}
