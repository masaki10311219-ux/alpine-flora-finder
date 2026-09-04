(() => {
  const els = {
    loading: document.getElementById("plant-loading"),
    notFound: document.getElementById("plant-not-found"),
    article: document.getElementById("plant-detail"),
    name: document.getElementById("plant-name"),
    kanji: document.getElementById("plant-kanji"),
    scientific: document.getElementById("plant-scientific"),
    photo: document.getElementById("plant-photo"),
    credit: document.getElementById("plant-credit"),
    specimenNo: document.getElementById("plant-specimen-no"),
    calloutSeason: document.getElementById("callout-season"),
    calloutColor: document.getElementById("callout-color"),
    calloutArea: document.getElementById("callout-area"),
    infoFamily: document.getElementById("info-family"),
    infoMonths: document.getElementById("info-months"),
    infoAreas: document.getElementById("info-areas"),
    infoPeaks: document.getElementById("info-peaks"),
    infoColors: document.getElementById("info-colors"),
    story: document.getElementById("plant-story"),
    gallery: document.getElementById("community-gallery"),
    communityEmpty: document.getElementById("community-empty"),
    form: document.getElementById("submission-form"),
    submitStatus: document.getElementById("submission-status")
  };

  function getPlantId() {
    return new URLSearchParams(location.search).get("id");
  }

  function monthLabel(months) {
    if (!months.length) return "不明";
    return `${Math.min(...months)}〜${Math.max(...months)}月`;
  }

  async function loadPlant() {
    const id = getPlantId();
    const res = await fetch("data/plants.json");
    const plants = await res.json();
    const index = plants.findIndex(p => p.id === id);

    if (index === -1) {
      els.loading.hidden = true;
      els.notFound.hidden = false;
      document.title = "見つかりませんでした | 高山植物早見図鑑";
      return;
    }

    const plant = plants[index];
    renderPlant(plant, index);
    initCommunity(plant);
  }

  function renderPlant(plant, index) {
    document.title = `${plant.name}（${plant.kanji || plant.scientific}）| 高山植物早見図鑑`;
    els.name.textContent = plant.name;
    els.kanji.textContent = plant.kanji ? `${plant.kanji} / ${plant.scientific}` : plant.scientific;
    els.scientific.textContent = plant.scientific;

    els.photo.alt = `${plant.name}（${plant.scientific}）の写真`;
    WikimediaImages.fetchImage(plant.scientific).then(({ url, credit }) => {
      els.photo.src = url;
      if (credit) {
        els.credit.innerHTML = `写真: <a href="${credit.pageUrl}" target="_blank" rel="noopener">${credit.artist} / Wikimedia Commons（${credit.license}）</a>`;
      }
    });

    els.specimenNo.textContent = `No.${String(index + 1).padStart(3, "0")}`;
    els.calloutSeason.textContent = `📅 ${monthLabel(plant.months)}`;
    els.calloutColor.textContent = `🎨 ${plant.colors.join("・")}`;
    els.calloutArea.textContent = `⛰️ ${plant.areas[0] || ""}`;

    els.infoFamily.textContent = plant.family;
    els.infoMonths.textContent = monthLabel(plant.months);
    els.infoAreas.textContent = plant.areas.join("、");
    els.infoPeaks.textContent = plant.peaks.length ? plant.peaks.join("、") : "特定の山は未登録";
    els.infoColors.textContent = plant.colors.join("、");

    els.story.textContent = plant.story || plant.desc;

    els.loading.hidden = true;
    els.article.hidden = false;
  }

  function galleryTile(sub, comments) {
    const wrap = document.createElement("div");
    wrap.className = "gallery-tile";
    const commentsForThis = comments.filter(c => c.submission_id === sub.id);

    wrap.innerHTML = `
      <img src="${sub.image_path}" alt="${escapeHtml(sub.nickname)}さんの投稿写真" loading="lazy">
      <div class="gallery-tile__body">
        <p class="gallery-tile__name">${escapeHtml(sub.nickname)}</p>
        <p class="gallery-tile__date">${Community.formatDate(sub.created_at)}${sub.caption ? " ・ " + escapeHtml(sub.caption) : ""}</p>
        <button type="button" class="gallery-tile__comments-btn">💬 コメント (${commentsForThis.length})</button>
        <div class="comment-panel" hidden>
          <ul class="comment-list"></ul>
          <form class="comment-form">
            <input type="text" placeholder="ニックネーム" class="comment-nickname" maxlength="40" required style="max-width:90px;">
            <input type="text" placeholder="コメント（不適切な投稿の報告もこちらへ）" class="comment-body" maxlength="300" required>
            <button type="submit" class="btn btn--ghost" style="padding:6px 10px; font-size:0.72rem;">送信</button>
          </form>
        </div>
      </div>
    `;

    const list = wrap.querySelector(".comment-list");
    commentsForThis.forEach(c => list.appendChild(commentItem(c)));

    const toggleBtn = wrap.querySelector(".gallery-tile__comments-btn");
    const panel = wrap.querySelector(".comment-panel");
    toggleBtn.addEventListener("click", () => { panel.hidden = !panel.hidden; });

    wrap.querySelector(".comment-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nickname = wrap.querySelector(".comment-nickname").value.trim();
      const body = wrap.querySelector(".comment-body").value.trim();
      if (!nickname || !body) return;
      try {
        const comment = await Community.createComment({ submissionId: sub.id, nickname, body });
        list.appendChild(commentItem(comment));
        toggleBtn.textContent = `💬 コメント (${list.children.length})`;
        wrap.querySelector(".comment-form").reset();
      } catch (err) {
        console.error(err);
      }
    });

    return wrap;
  }

  function commentItem(c) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="comment__name">${escapeHtml(c.nickname)}</span>：${escapeHtml(c.body)}`;
    return li;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  async function initCommunity(plant) {
    if (!Community.isConfigured()) {
      els.submitStatus.textContent = "投稿機能は準備中です。サイト管理者がSupabaseの設定を完了すると利用できます。";
      els.form.querySelector("button[type=submit]").disabled = true;
      els.communityEmpty.hidden = false;
      els.communityEmpty.textContent = "投稿機能は準備中です。";
      return;
    }

    try {
      const submissions = await Community.fetchSubmissions(plant.id);
      const comments = await Community.fetchComments(submissions.map(s => s.id));
      renderGallery(submissions, comments);
    } catch (err) {
      console.error(err);
      els.communityEmpty.hidden = false;
      els.communityEmpty.textContent = "投稿の読み込みに失敗しました。時間をおいて再度お試しください。";
    }

    els.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nickname = document.getElementById("submit-nickname").value.trim();
      const caption = document.getElementById("submit-caption").value.trim();
      const file = document.getElementById("submit-file").files[0];
      if (!nickname || !file) return;

      els.submitStatus.textContent = "投稿しています…";
      try {
        const sub = await Community.createSubmission({ plantId: plant.id, nickname, caption, file });
        els.communityEmpty.hidden = true;
        els.gallery.prepend(galleryTile(sub, []));
        els.submitStatus.textContent = "投稿しました！ありがとうございます。";
        els.form.reset();
      } catch (err) {
        console.error(err);
        els.submitStatus.textContent = "投稿に失敗しました。時間をおいて再度お試しください。";
      }
    });
  }

  function renderGallery(submissions, comments) {
    els.gallery.innerHTML = "";
    if (!submissions.length) {
      els.communityEmpty.hidden = false;
      return;
    }
    els.communityEmpty.hidden = true;
    submissions.forEach(sub => els.gallery.appendChild(galleryTile(sub, comments)));
  }

  loadPlant();
})();
