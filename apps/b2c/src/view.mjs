import { axes, formatScore, maxScore, minScore } from "./receipt.mjs";
import { copy } from "./copy.mjs";

/** @typedef {keyof typeof copy} Locale */
/** @typedef {Partial<import("./receipt.mjs").Scores>} Draft */
/** @typedef {ReturnType<import("./receipt.mjs").rankReceipt>} Receipt */

/** @param {Locale} locale @param {Draft} draft @param {Receipt | null} receipt @param {boolean} ready */
export function renderPage(locale, draft, receipt, ready) {
  const t = copy[locale];
  return `
    <a class="skip" href="#main">${t.skip}</a>
    <header class="shell masthead">
      <span class="wordmark">unstandard<span>.</span></span>
      <button type="button" data-action="language" lang="${locale === "en" ? "ko" : "en"}" ${ready ? "" : "hidden"}>${locale === "en" ? "한국어" : "English"}</button>
    </header>
    <main id="main" class="shell" tabindex="-1">
      <div class="hero">
        <div class="introduction">
          <h1>${t.title}</h1>
          <p>${t.intro}</p>
          <a class="primary" href="#quiz" ${ready ? "" : "hidden"}>${t.start} <span aria-hidden="true">↓</span></a>
        </div>
        <figure class="sample" aria-labelledby="sample-title">
          <figcaption id="sample-title">
            <span class="eyebrow">${t.sampleTitle}</span>
            <span class="muted">${t.sampleLabel}</span>
          </figcaption>
          <blockquote>${t.quote}</blockquote>
          <dl>${t.sampleDetails.map(([label, detail]) => `<div><dt>${label}</dt><dd>${detail}</dd></div>`).join("")}</dl>
        </figure>
      </div>
      <noscript><p>${t.noscript}</p></noscript>
      <section id="quiz" class="section quiz" tabindex="-1" aria-labelledby="quiz-title" ${ready ? "" : "hidden"}>
        <h2 id="quiz-title">${receipt ? t.resultTitle : t.quizTitle}</h2>
        ${receipt ? renderReceipt(locale, receipt) : renderQuestions(locale, draft)}
      </section>
      <section id="plans" class="section offers" tabindex="-1" aria-labelledby="plans-title">
        <h2 id="plans-title">${t.plansTitle}</h2>
        <div class="offer-grid">
          <div><h3>${t.free}</h3><p>${t.freeInfo}</p></div>
          <div>
            <h3>${t.price}</h3>
            <p class="eyebrow">${t.trialPrice}</p>
            <p>${t.paidInfo}</p>
            <p>${t.absence}</p>
            <p class="muted">${t.access}</p>
            <p class="closed">${t.closed}</p>
          </div>
        </div>
      </section>
    </main>`;
}

/** @param {Locale} locale @param {Draft} draft */
function renderQuestions(locale, draft) {
  const t = copy[locale];
  return `
    <p class="section-intro">${t.quizIntro}</p>
    <p class="muted">${t.privacy}</p>
    <ol class="questions">${axes.map((axis) => {
      const {label, low, high} = t.axis[axis];
      const values = Array.from({length: maxScore - minScore + 1}, (_, index) => minScore + index);
      return `<li>
        <label for="score-${axis}">${label}</label>
        <select id="score-${axis}" aria-describedby="ends-${axis}">
          <option value="">${t.choose}</option>
          ${values.map((score) => `<option value="${score}" ${draft[axis] === score ? "selected" : ""}>${formatScore(score)}</option>`).join("")}
        </select>
        <div class="ends" id="ends-${axis}"><span><b>−5</b> ${low}</span><span><b>+5</b> ${high}</span></div>
      </li>`;
    }).join("")}</ol>
    <div class="quiz-actions">
      <button type="button" class="primary" data-action="receipt">${t.submit} <span aria-hidden="true">→</span></button>
      <p id="progress" class="muted" role="status">${t.progress(Object.keys(draft).length)}</p>
    </div>
    <p id="error" class="error" role="alert"></p>`;
}

/** @param {Locale} locale @param {Receipt} receipt */
function renderReceipt(locale, receipt) {
  const t = copy[locale];
  return `
    <p class="section-intro">${receipt.allNeutral ? t.neutral : t.resultIntro}</p>
    <ol class="ranked">${receipt.top.map(({axis, score}) => {
      const {label, low, high, neutral} = t.axis[axis];
      const preference = score === 0 ? neutral : score < 0 ? low : high;
      return `<li data-axis="${axis}"><span class="score">${formatScore(score)}</span><div><h3>${label}</h3><p>${preference}</p></div></li>`;
    }).join("")}</ol>
    <div class="quiz-actions">
      <button type="button" class="secondary" data-action="edit">${t.edit}</button>
      <a href="#plans">${t.resultSample}</a>
    </div>`;
}
