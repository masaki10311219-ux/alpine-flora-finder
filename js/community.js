/**
 * 「みんなの投稿写真」＋コメント機能。
 * SDKは使わず、Supabase の REST(PostgREST) / Storage API を直接 fetch で叩く。
 * ログイン不要・ニックネームのみで投稿でき、投稿は承認なしで即時公開される
 * （about.html にモデレーション方針を明記）。
 */
const Community = (() => {
  const BUCKET = "flower-photos";

  function isConfigured() {
    return !!(SITE_CONFIG.SUPABASE_URL && SITE_CONFIG.SUPABASE_ANON_KEY);
  }

  function headers(extra) {
    return Object.assign(
      {
        apikey: SITE_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SITE_CONFIG.SUPABASE_ANON_KEY}`
      },
      extra || {}
    );
  }

  async function fetchSubmissions(plantId) {
    const url = `${SITE_CONFIG.SUPABASE_URL}/rest/v1/submissions?plant_id=eq.${encodeURIComponent(plantId)}&select=*&order=created_at.desc`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error("submissions fetch failed");
    return res.json();
  }

  async function fetchComments(submissionIds) {
    if (!submissionIds.length) return [];
    const idList = submissionIds.map(encodeURIComponent).join(",");
    const url = `${SITE_CONFIG.SUPABASE_URL}/rest/v1/comments?submission_id=in.(${idList})&select=*&order=created_at.asc`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error("comments fetch failed");
    return res.json();
  }

  async function uploadImage(file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await fetch(`${SITE_CONFIG.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": file.type || "application/octet-stream" }),
      body: file
    });
    if (!res.ok) throw new Error("image upload failed");
    return `${SITE_CONFIG.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  async function createSubmission({ plantId, nickname, caption, file }) {
    const imageUrl = await uploadImage(file);
    const res = await fetch(`${SITE_CONFIG.SUPABASE_URL}/rest/v1/submissions`, {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify([{
        plant_id: plantId,
        nickname: nickname.slice(0, 40),
        caption: (caption || "").slice(0, 200),
        image_path: imageUrl
      }])
    });
    if (!res.ok) throw new Error("submission insert failed");
    const rows = await res.json();
    return rows[0];
  }

  async function createComment({ submissionId, nickname, body }) {
    const res = await fetch(`${SITE_CONFIG.SUPABASE_URL}/rest/v1/comments`, {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify([{
        submission_id: submissionId,
        nickname: nickname.slice(0, 40),
        body: body.slice(0, 300)
      }])
    });
    if (!res.ok) throw new Error("comment insert failed");
    const rows = await res.json();
    return rows[0];
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  return { isConfigured, fetchSubmissions, fetchComments, createSubmission, createComment, formatDate };
})();
