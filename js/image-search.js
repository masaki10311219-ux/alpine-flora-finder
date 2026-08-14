(() => {
  const fileInput = document.getElementById("photo-input");
  const uploadBox = document.getElementById("upload-box");
  const previewWrap = document.getElementById("upload-preview-wrap");
  const resultEl = document.getElementById("image-search-result");

  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    showPreview(file);

    if (!SITE_CONFIG.PLANTNET_API_KEY) {
      resultEl.innerHTML = `<p class="status-msg is-error">
        画像検索は準備中です。サイト管理者が PlantNet の API キーを設定すると利用できるようになります。
        （無料キーは <a href="https://my.plantnet.org/" target="_blank" rel="noopener">my.plantnet.org</a> で取得できます）
      </p>`;
      return;
    }

    resultEl.innerHTML = `<p class="status-msg">識別中です…</p>`;

    try {
      const candidates = await identify(file);
      renderCandidates(candidates);
    } catch (err) {
      console.error(err);
      resultEl.innerHTML = `<p class="status-msg is-error">識別に失敗しました。時間をおいて再度お試しください。</p>`;
    }
  });

  function showPreview(file) {
    const url = URL.createObjectURL(file);
    previewWrap.innerHTML = `<img src="${url}" alt="アップロードした写真のプレビュー">`;
  }

  async function identify(file) {
    const form = new FormData();
    form.append("images", file);
    form.append("organs", "flower");

    const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(SITE_CONFIG.PLANTNET_API_KEY)}`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`plantnet api error: ${res.status}`);
    const data = await res.json();
    return (data.results || []).slice(0, 5);
  }

  function renderCandidates(candidates) {
    if (!candidates.length) {
      resultEl.innerHTML = `<p class="status-msg">候補が見つかりませんでした。花全体が写るように、明るい場所で撮り直してみてください。</p>`;
      return;
    }

    resultEl.innerHTML = "";
    candidates.forEach(c => {
      const scientificName = c.species?.scientificNameWithoutAuthor || "";
      const commonName = c.species?.commonNames?.[0] || "";
      const scorePct = Math.round((c.score || 0) * 100);
      const localMatch = findLocalMatch(scientificName);

      const card = document.createElement("div");
      card.className = "id-candidate";
      card.innerHTML = `
        <span class="id-candidate__score">${scorePct}%</span>
        <div class="id-candidate__name">${commonName || scientificName}</div>
        <div class="id-candidate__scientific">${scientificName}</div>
        ${localMatch ? `<div class="id-candidate__match">図鑑内に一致：<a href="#plant-${localMatch.id}">${localMatch.name}の詳細を見る</a></div>` : ""}
      `;
      resultEl.appendChild(card);
    });
  }

  function findLocalMatch(scientificName) {
    if (!scientificName || !window.__PLANTS_DATA__) return null;
    const genus = scientificName.split(" ")[0].toLowerCase();
    return window.__PLANTS_DATA__.find(p => {
      const local = p.scientific.toLowerCase();
      return local === scientificName.toLowerCase() || local.startsWith(genus + " ");
    }) || null;
  }
})();
