/**
 * 高山植物クイズ。data/plants.json からランダムに問題を生成する（固定パターンは持たない）。
 * 出題形式：①写真→名前 ②名前→開花時期 ③名前→エリア　の3種類をランダムに出す。
 * quiz.html?a=山域ID で開くと、その山域で見られる花だけを正解として出題する（登る前の予習用。旧URLの ?m=山名 はその山の山域）。
 * 答えたあとは、その花の説明（花期・見られる山域・紹介文）を表示し、最後に出た花の一覧でおさらいできる。
 */
(() => {
  const BEST_KEY = "alpineFloraQuiz.best";
  const DIFFICULTY_LABEL = { easy: "かんたん", normal: "ふつう", hard: "むずかしい" };

  const els = {
    start: document.getElementById("quiz-start"),
    play: document.getElementById("quiz-play"),
    result: document.getElementById("quiz-result"),
    lengthButtons: document.querySelectorAll(".quiz-length"),
    difficultyButtons: document.querySelectorAll(".quiz-difficulty"),
    beginBtn: document.getElementById("quiz-begin"),
    bestText: document.getElementById("quiz-best"),
    progressText: document.getElementById("quiz-progress-text"),
    scoreText: document.getElementById("quiz-score-text"),
    question: document.getElementById("quiz-question"),
    photoWrap: document.getElementById("quiz-photo-wrap"),
    photo: document.getElementById("quiz-photo"),
    subject: document.getElementById("quiz-subject"),
    options: document.getElementById("quiz-options"),
    feedback: document.getElementById("quiz-feedback"),
    nextBtn: document.getElementById("quiz-next"),
    resultRibbon: document.getElementById("quiz-result-ribbon"),
    resultScore: document.getElementById("quiz-result-score"),
    resultComment: document.getElementById("quiz-result-comment"),
    resultBest: document.getElementById("quiz-result-best"),
    retryBtn: document.getElementById("quiz-retry"),
    title: document.getElementById("quiz-title"),
    lead: document.getElementById("quiz-lead"),
    scope: document.getElementById("quiz-scope"),
    explain: document.getElementById("quiz-explain"),
    review: document.getElementById("quiz-review"),
    listLink: document.getElementById("quiz-list-link")
  };

  let plants = [];
  let targets = [];
  let scopeKey = "";
  let questionCount = 10;
  let difficulty = "normal";
  let quiz = [];
  let current = 0;
  let score = 0;
  let answered = false;
  let deck = [];

  // 同じ花がなるべく続けて出ないよう、正解候補をシャッフルした山から順に引く
  function drawTarget() {
    if (!deck.length) deck = shuffle(targets);
    return deck.pop();
  }

  // 植物データのエリア → 図鑑の山域名（「南アルプス」と「中央・南アルプス」のような重複をまとめる）
  function areaNames(plant) {
    const toName = typeof MountainFlora !== "undefined" ? MountainFlora.areaNameForPlantArea : (a) => a;
    return [...new Set(plant.areas.map(toName))];
  }

  function monthLabel(months) {
    if (!months || !months.length) return "不明";
    return `${Math.min(...months)}〜${Math.max(...months)}月`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 難易度によって「まぎらわしい選択肢」の選び方を変える。
  // かんたん：科が違う（見た目も系統も遠い）植物から選ぶ
  // ふつう　：完全ランダム
  // むずかしい：同じ科、または同じ色を持つ植物を優先（見分けにくい）
  function distractorPool(correct) {
    const others = plants.filter(p => p.id !== correct.id);

    if (difficulty === "easy") {
      const pool = others.filter(p => p.family !== correct.family);
      return pool.length >= 3 ? pool : others;
    }

    if (difficulty === "hard") {
      let pool = others.filter(p => p.family === correct.family);
      if (pool.length < 3) {
        pool = others.filter(p => p.colors.some(c => correct.colors.includes(c)));
      }
      return pool.length >= 3 ? pool : others;
    }

    return others;
  }

  function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  function buildQuestion() {
    const types = ["photo-name", "name-month", "name-area"];
    const type = types[Math.floor(Math.random() * types.length)];
    const correct = drawTarget();
    const pool = distractorPool(correct);

    if (type === "photo-name") {
      const distractors = pickRandom(pool, 3);
      const options = shuffle([correct, ...distractors]).map(p => ({ label: p.name, correct: p.id === correct.id }));
      return { type, correct, prompt: "この花の名前は？", options, revealName: false };
    }

    if (type === "name-month") {
      const correctLabel = monthLabel(correct.months);
      const candidates = pool.filter(p => monthLabel(p.months) !== correctLabel);
      const distractorLabels = [];
      shuffle(candidates).some(p => {
        const label = monthLabel(p.months);
        if (!distractorLabels.includes(label)) distractorLabels.push(label);
        return distractorLabels.length >= 3;
      });
      const options = shuffle([
        { label: correctLabel, correct: true },
        ...distractorLabels.map(label => ({ label, correct: false }))
      ]);
      return {
        type, correct,
        prompt: "この花が咲くのは何月ごろ？",
        options,
        revealName: true
      };
    }

    // name-area
    const correctAreas = areaNames(correct);
    const correctArea = correctAreas[Math.floor(Math.random() * correctAreas.length)];
    const distractorAreas = [];
    shuffle(pool.length >= 3 ? pool : plants).some(p => {
      shuffle(areaNames(p)).some(area => {
        if (!correctAreas.includes(area) && !distractorAreas.includes(area)) distractorAreas.push(area);
        return true;
      });
      return distractorAreas.length >= 3;
    });
    if (distractorAreas.length < 3) {
      shuffle([...new Set(plants.flatMap(areaNames))]).forEach(area => {
        if (distractorAreas.length < 3 && !correctAreas.includes(area) && !distractorAreas.includes(area)) distractorAreas.push(area);
      });
    }
    const options = shuffle([
      { label: correctArea, correct: true },
      ...distractorAreas.map(label => ({ label, correct: false }))
    ]);
    return {
      type, correct,
      prompt: "この花が見られるエリアは？",
      options,
      revealName: true
    };
  }

  function startQuiz() {
    deck = [];
    quiz = Array.from({ length: questionCount }, buildQuestion);
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
    els.question.textContent = q.prompt;
    els.feedback.hidden = true;
    els.explain.hidden = true;
    els.nextBtn.hidden = true;

    // どの出題形式でも必ず写真を表示する（名前を当てる問題では名前だけ隠す）
    els.photoWrap.hidden = false;
    els.photo.src = WikimediaImages.FALLBACK_IMG;
    els.photo.alt = "";
    WikimediaImages.fetchImage(q.correct.scientific).then(({ url }) => {
      els.photo.src = url;
    });

    if (q.revealName) {
      els.subject.hidden = false;
      els.subject.textContent = `${q.correct.name}（${q.correct.kanji || q.correct.scientific}）`;
    } else {
      els.subject.hidden = true;
    }

    els.options.innerHTML = "";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => selectAnswer(btn, opt));
      els.options.appendChild(btn);
    });
  }

  function selectAnswer(btn, opt) {
    if (answered) return;
    answered = true;
    quiz[current].isCorrect = opt.correct;

    const buttons = Array.from(els.options.children);
    buttons.forEach(b => b.disabled = true);

    if (opt.correct) {
      btn.classList.add("is-correct");
      score++;
      els.feedback.textContent = "正解！🎉";
      els.feedback.className = "quiz-feedback is-correct";
    } else {
      btn.classList.add("is-wrong");
      const correctBtn = buttons.find(b => b.textContent === quiz[current].options.find(o => o.correct).label);
      if (correctBtn) correctBtn.classList.add("is-correct");
      els.feedback.textContent = "残念…！";
      els.feedback.className = "quiz-feedback is-wrong";
    }

    els.scoreText.textContent = `正解数：${score}`;
    els.feedback.hidden = false;
    showExplanation(quiz[current].correct);
    els.nextBtn.hidden = false;
    els.nextBtn.textContent = current + 1 < quiz.length ? "次の問題へ →" : "結果を見る →";
  }

  // 答えたあとに出す、その花の説明
  function showExplanation(p) {
    els.subject.hidden = false;
    els.subject.textContent = `${p.name}（${p.kanji || p.scientific}）`;
    const areas = areaNames(p);
    els.explain.innerHTML = `
      <p class="quiz-explain__name">${escapeHtml(p.name)}<small>${escapeHtml([p.kanji, p.family].filter(Boolean).join(" ・ "))}</small></p>
      <dl class="quiz-explain__facts">
        <dt>花期</dt><dd>${escapeHtml(monthLabel(p.months))}</dd>
        <dt>見られる山域</dt><dd>${escapeHtml(areas.join("、") || "―")}</dd>
        ${p.colors && p.colors.length ? `<dt>花の色</dt><dd>${escapeHtml(p.colors.join("、"))}</dd>` : ""}
      </dl>
      <p class="quiz-explain__desc">${escapeHtml(p.desc)}</p>
      ${p.story ? `<details class="quiz-explain__more"><summary>もっと知る</summary><p>${escapeHtml(p.story)}</p></details>` : ""}
      <a class="quiz-explain__link" href="plant.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">図鑑ページを開く ↗</a>`;
    els.explain.hidden = false;
  }

  // 結果画面：今回出た花の一覧（同じ花が複数回出たら1つにまとめる）
  function renderReview() {
    const seen = new Map();
    quiz.forEach(q => {
      const prev = seen.get(q.correct.id);
      seen.set(q.correct.id, { plant: q.correct, ok: (prev ? prev.ok : true) && q.isCorrect });
    });
    els.review.innerHTML = [...seen.values()].map(({ plant: p, ok }) => `
      <li class="quiz-review__item${ok ? "" : " is-wrong"}">
        <span class="quiz-review__thumb"><img alt="" data-sci="${escapeHtml(p.scientific)}" src="${WikimediaImages.FALLBACK_IMG}"></span>
        <span class="quiz-review__main">
          <span class="quiz-review__head"><span class="quiz-review__mark">${ok ? "○" : "×"}</span><a href="plant.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a><small>${escapeHtml(monthLabel(p.months))}</small></span>
          <span class="quiz-review__desc">${escapeHtml(p.desc)}</span>
        </span>
      </li>`).join("");
    els.review.querySelectorAll("img[data-sci]").forEach(img => {
      WikimediaImages.fetchImage(img.dataset.sci).then(({ url }) => { img.src = url; });
    });
  }

  function nextQuestion() {
    current++;
    if (current >= quiz.length) {
      showResult();
    } else {
      showQuestion();
    }
  }

  function showResult() {
    els.play.hidden = true;
    els.result.hidden = false;

    const total = quiz.length;
    const rate = score / total;
    els.resultScore.textContent = `${total}問中 ${score}問 正解！`;

    let comment;
    if (rate === 1) comment = "パーフェクト！高山植物マスターです🏔️";
    else if (rate >= 0.8) comment = "かなり詳しいですね！その調子！";
    else if (rate >= 0.5) comment = "なかなかいい調子。図鑑を見返してもう一回！";
    else comment = "これから覚えていきましょう。図鑑ページも見てみてね。";
    els.resultComment.textContent = comment;
    renderReview();

    const best = loadBest();
    const key = bestKey(total, difficulty);
    const prevBest = best[key] || 0;
    if (score > prevBest) {
      best[key] = score;
      saveBest(best);
      els.resultBest.textContent = "🎉 自己ベスト更新！";
    } else {
      els.resultBest.textContent = `自己ベスト（${DIFFICULTY_LABEL[difficulty]}・${total}問）：${best[key]}問正解`;
    }
  }

  function bestKey(count, level) {
    return `${scopeKey}${count}-${level}`;
  }

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveBest(best) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      // localStorageが使えない環境では何もしない
    }
  }

  function updateBestOnStartScreen() {
    const best = loadBest();
    const key = bestKey(questionCount, difficulty);
    if (best[key]) {
      els.bestText.hidden = false;
      els.bestText.textContent = `自己ベスト（${DIFFICULTY_LABEL[difficulty]}・${questionCount}問）：${best[key]}問正解`;
    } else {
      els.bestText.hidden = true;
    }
  }

  async function init() {
    const res = await fetch("data/plants.json");
    plants = await res.json();
    targets = plants;
    await applyMountainScope();

    els.lengthButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        els.lengthButtons.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        questionCount = Number(btn.dataset.count);
        updateBestOnStartScreen();
      });
    });

    els.difficultyButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        els.difficultyButtons.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        difficulty = btn.dataset.difficulty;
        updateBestOnStartScreen();
      });
    });

    els.beginBtn.addEventListener("click", startQuiz);
    els.nextBtn.addEventListener("click", nextQuestion);
    els.retryBtn.addEventListener("click", () => {
      els.result.hidden = true;
      els.start.hidden = false;
      updateBestOnStartScreen();
    });

    updateBestOnStartScreen();
  }

  // ?a=山域ID（旧URLは ?m=山名）があれば、その山域で見られる花だけを正解として出題する
  async function applyMountainScope() {
    if (typeof MountainFlora === "undefined") return;
    const params = new URLSearchParams(location.search);
    if (!params.get("a") && !params.get("m")) return;
    let area;
    try {
      const { areas, mountains } = await MountainFlora.load();
      area = MountainFlora.areaById(areas, params.get("a"))
        || MountainFlora.areaForMountain(areas, mountains.find((m) => m.name === params.get("m")));
    } catch (err) {
      console.error(err);
    }
    if (!area) return;

    const listUrl = MountainFlora.pageUrl(area);
    const own = MountainFlora.plantsForArea(area, plants).map((e) => e.item);
    if (!own.length) {
      els.scope.innerHTML = `${escapeHtml(area.name)}の花のデータがまだ無いため、全国の高山植物から出題します。`;
      return;
    }
    targets = own;
    scopeKey = `area:${area.id}:`;
    els.title.textContent = `🌸 ${area.name}の花クイズ`;
    els.lead.textContent = `${area.name}で見られる${own.length}種の花から出題します。登る前の予習にどうぞ。`;
    els.scope.innerHTML = `<a href="${listUrl}">📖 ${escapeHtml(area.name)}の花を一覧で見る</a> ・ <a href="quiz.html">全国の花から出題する</a>`;
    els.listLink.href = listUrl;
    els.listLink.textContent = `📖 ${area.name}の花の一覧`;
    document.title = `${area.name}の花クイズ | 山美和 -Yamabiyori-`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  init();
})();
