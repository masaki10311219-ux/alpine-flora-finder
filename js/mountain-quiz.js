/**
 * 山クイズ。data/mountain-quiz.json（tools/build-mountain-quiz.js で生成）から出題する。
 * ジャンルと問題数を選んで4択で答える。答えるたびに解説を出し、最後におさらい一覧を出す。
 * 正解した問題はこのブラウザ（localStorage）に記録し、「まだ正解していない問題」から優先して出題できる。
 */
(() => {
  const SOLVED_KEY = "yamabiyori:mountain-quiz-solved";
  const $ = (id) => document.getElementById(id);
  const els = {
    start: $("mq-start"), play: $("mq-play"), result: $("mq-result"), status: $("mq-status"),
    total: $("mq-total"), progress: $("mq-progress"), cats: $("mq-cats"), lengths: $("mq-lengths"), unsolved: $("mq-unsolved"), begin: $("mq-begin"),
    progressText: $("mq-progress-text"), scoreText: $("mq-score-text"), catLabel: $("mq-cat-label"), question: $("mq-question"),
    options: $("mq-options"), feedback: $("mq-feedback"), explain: $("mq-explain"), next: $("mq-next"),
    resultScore: $("mq-result-score"), resultComment: $("mq-result-comment"), retry: $("mq-retry"), review: $("mq-review")
  };

  let bank = [];
  let categories = {};
  let cat = "all";
  let count = 10;
  let solved = loadSolved();
  let quiz = [];
  let current = 0;
  let score = 0;
  let answered = false;

  init();

  async function init() {
    try {
      const res = await fetch("data/mountain-quiz.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      bank = data.questions;
      categories = data.categories;
    } catch (err) {
      console.error(err);
      els.status.hidden = false;
      els.status.textContent = "問題を読み込めませんでした。再読み込みしてください。";
      els.begin.disabled = true;
      return;
    }

    const param = new URLSearchParams(location.search).get("cat");
    if (param && categories[param]) cat = param;
    els.total.textContent = bank.length;

    els.cats.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (b) { cat = b.dataset.cat; renderStart(); }
    });
    els.lengths.addEventListener("click", (e) => {
      const b = e.target.closest("[data-count]");
      if (!b) return;
      count = Number(b.dataset.count);
      els.lengths.querySelectorAll("[data-count]").forEach((x) => x.classList.toggle("is-active", x === b));
    });
    els.begin.addEventListener("click", startQuiz);
    els.next.addEventListener("click", nextQuestion);
    els.retry.addEventListener("click", () => { els.result.hidden = true; els.start.hidden = false; renderStart(); window.scrollTo(0, 0); });

    renderStart();
  }

  /* ===== スタート画面 ===== */
  function inCat(q, c) {
    return c === "all" || q.cat === c;
  }

  function renderStart() {
    const solvedIn = (c) => bank.filter((q) => inCat(q, c) && solved[q.id]).length;
    const totalIn = (c) => bank.filter((q) => inCat(q, c)).length;
    els.cats.innerHTML = [["all", "すべて"], ...Object.entries(categories)].map(([key, label]) =>
      `<button type="button" class="chip${cat === key ? " is-active" : ""}" data-cat="${key}" aria-pressed="${cat === key}">${esc(label)}<small>${solvedIn(key)}/${totalIn(key)}</small></button>`
    ).join("");
    const n = solvedIn("all");
    const pct = Math.round((n / bank.length) * 100);
    els.progress.innerHTML = `
      <div class="mf-progress__item"><span>⛰️ 正解した問題</span><span class="mf-progress__bar"><span style="width:${pct}%"></span></span><span class="mf-progress__num">${n} / ${bank.length}</span></div>`;
    history.replaceState(null, "", cat === "all" ? location.pathname : `?cat=${cat}`);
  }

  /* ===== 出題 ===== */
  function startQuiz() {
    const pool = bank.filter((q) => inCat(q, cat));
    const fresh = shuffle(pool.filter((q) => !solved[q.id]));
    const rest = shuffle(pool.filter((q) => solved[q.id]));
    const ordered = els.unsolved.checked ? [...fresh, ...rest] : shuffle(pool);
    // 選択肢の並びも毎回シャッフルする
    quiz = ordered.slice(0, count).map((q) => {
      const order = shuffle(q.choices.map((_, i) => i));
      return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer), result: null };
    });
    current = 0;
    score = 0;
    els.start.hidden = true;
    els.result.hidden = true;
    els.play.hidden = false;
    showQuestion();
  }

  function showQuestion() {
    answered = false;
    const q = quiz[current];
    els.progressText.textContent = `第${current + 1}問 / ${quiz.length}問`;
    els.scoreText.textContent = `正解数：${score}`;
    els.catLabel.textContent = categories[q.cat] || "";
    els.question.textContent = q.q;
    els.feedback.hidden = true;
    els.explain.hidden = true;
    els.next.hidden = true;
    els.options.innerHTML = "";
    q.choices.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = label;
      btn.addEventListener("click", () => answer(i));
      els.options.appendChild(btn);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function answer(i) {
    if (answered) return;
    answered = true;
    const q = quiz[current];
    const ok = i === q.answer;
    q.result = ok;
    const buttons = [...els.options.children];
    buttons.forEach((b) => (b.disabled = true));
    buttons[q.answer].classList.add("is-correct");
    if (!ok) buttons[i].classList.add("is-wrong");

    if (ok) {
      score++;
      solved = { ...solved, [q.id]: 1 };
      saveSolved();
    }
    els.feedback.textContent = ok ? "正解！🎉" : `残念…！ 正解は「${q.choices[q.answer]}」`;
    els.feedback.className = `quiz-feedback ${ok ? "is-correct" : "is-wrong"}`;
    els.feedback.hidden = false;
    els.explain.innerHTML = `<p class="quiz-explain__name">解説</p><p class="quiz-explain__desc">${esc(q.explain)}</p>`;
    els.explain.hidden = false;
    els.scoreText.textContent = `正解数：${score}`;
    els.next.textContent = current + 1 < quiz.length ? "次の問題へ →" : "結果を見る →";
    els.next.hidden = false;
  }

  function nextQuestion() {
    current++;
    if (current >= quiz.length) showResult();
    else showQuestion();
  }

  function showResult() {
    els.play.hidden = true;
    els.result.hidden = false;
    const total = quiz.length;
    const rate = score / total;
    els.resultScore.textContent = `${total}問中 ${score}問 正解！`;
    els.resultComment.textContent =
      rate === 1 ? "パーフェクト！山博士です⛰️" :
      rate >= 0.8 ? "かなり詳しいですね！" :
      rate >= 0.5 ? "なかなかの山好き。解説を読んでもう一回！" :
      "これから覚えていきましょう。間違えた問題は次回また出ます。";
    els.review.innerHTML = quiz.map((q) => `
      <li class="quiz-review__item${q.result ? "" : " is-wrong"}">
        <span class="quiz-review__mark mq-review__mark">${q.result ? "○" : "×"}</span>
        <span class="quiz-review__main">
          <span class="quiz-review__head">${esc(q.q)}</span>
          <span class="quiz-review__desc"><strong>答え：${esc(q.choices[q.answer])}</strong> ${esc(q.explain)}</span>
        </span>
      </li>`).join("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ===== 共通 ===== */
  function loadSolved() {
    try { return JSON.parse(localStorage.getItem(SOLVED_KEY) || "{}") || {}; } catch (_) { return {}; }
  }

  function saveSolved() {
    try { localStorage.setItem(SOLVED_KEY, JSON.stringify(solved)); } catch (_) { /* 保存できなくても遊べる */ }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
