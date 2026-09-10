/**
 * 高山植物クイズ。data/plants.json からランダムに問題を生成する（固定パターンは持たない）。
 * 出題形式：①写真→名前 ②名前→開花時期 ③名前→エリア　の3種類をランダムに出す。
 */
(() => {
  const BEST_KEY = "alpineFloraQuiz.best";

  const els = {
    start: document.getElementById("quiz-start"),
    play: document.getElementById("quiz-play"),
    result: document.getElementById("quiz-result"),
    lengthButtons: document.querySelectorAll(".quiz-length"),
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
    retryBtn: document.getElementById("quiz-retry")
  };

  let plants = [];
  let questionCount = 10;
  let quiz = [];
  let current = 0;
  let score = 0;
  let answered = false;

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

  function pickRandom(arr, n, exclude) {
    const pool = arr.filter(p => p !== exclude);
    return shuffle(pool).slice(0, n);
  }

  function buildQuestion() {
    const types = ["photo-name", "name-month", "name-area"];
    const type = types[Math.floor(Math.random() * types.length)];
    const correct = plants[Math.floor(Math.random() * plants.length)];

    if (type === "photo-name") {
      const distractors = pickRandom(plants, 3, correct);
      const options = shuffle([correct, ...distractors]).map(p => ({ label: p.name, correct: p.id === correct.id }));
      return { type, correct, prompt: "この花の名前は？", options, showPhoto: true, subjectText: null };
    }

    if (type === "name-month") {
      const correctLabel = monthLabel(correct.months);
      const others = plants.filter(p => p.id !== correct.id && monthLabel(p.months) !== correctLabel);
      const distractorLabels = [];
      shuffle(others).some(p => {
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
        showPhoto: false,
        subjectText: `${correct.name}（${correct.kanji || correct.scientific}）`
      };
    }

    // name-area
    const correctArea = correct.areas[Math.floor(Math.random() * correct.areas.length)];
    const others = plants.filter(p => p.id !== correct.id && !p.areas.includes(correctArea));
    const distractorAreas = [];
    shuffle(others).some(p => {
      const area = p.areas[0];
      if (area && !distractorAreas.includes(area)) distractorAreas.push(area);
      return distractorAreas.length >= 3;
    });
    const options = shuffle([
      { label: correctArea, correct: true },
      ...distractorAreas.map(label => ({ label, correct: false }))
    ]);
    return {
      type, correct,
      prompt: "この花が見られるエリアは？",
      options,
      showPhoto: false,
      subjectText: `${correct.name}（${correct.kanji || correct.scientific}）`
    };
  }

  function startQuiz() {
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
    els.nextBtn.hidden = true;

    if (q.showPhoto) {
      els.photoWrap.hidden = false;
      els.subject.hidden = true;
      els.photo.src = WikimediaImages.FALLBACK_IMG;
      els.photo.alt = "";
      WikimediaImages.fetchImage(q.correct.scientific).then(({ url }) => {
        els.photo.src = url;
      });
    } else {
      els.photoWrap.hidden = true;
      els.subject.hidden = false;
      els.subject.textContent = q.subjectText;
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
    els.nextBtn.hidden = false;
    els.nextBtn.textContent = current + 1 < quiz.length ? "次の問題へ →" : "結果を見る →";
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

    const best = loadBest();
    const key = String(total);
    const prevBest = best[key] || 0;
    if (score > prevBest) {
      best[key] = score;
      saveBest(best);
      els.resultBest.textContent = "🎉 自己ベスト更新！";
    } else {
      els.resultBest.textContent = `自己ベスト（${total}問）：${best[key]}問正解`;
    }
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
    const key = String(questionCount);
    if (best[key]) {
      els.bestText.hidden = false;
      els.bestText.textContent = `自己ベスト（${questionCount}問）：${best[key]}問正解`;
    } else {
      els.bestText.hidden = true;
    }
  }

  async function init() {
    const res = await fetch("data/plants.json");
    plants = await res.json();

    els.lengthButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        els.lengthButtons.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        questionCount = Number(btn.dataset.count);
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

  init();
})();
