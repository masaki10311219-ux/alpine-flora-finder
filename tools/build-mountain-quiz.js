/**
 * 山クイズの問題集（data/mountain-quiz.json）を生成する。
 *   node tools/build-mountain-quiz.js
 *
 * 元データ：
 *   data/hyakumeizan.json   … Wikipedia「日本百名山」の一覧表（山名・よみ・標高・山系・都道府県・備考）
 *   data/pref-highest.json  … Wikipedia「各都道府県の最高峰」の一覧表
 *   このファイル内の GENERAL … 手書きの山の知識問題
 * 選択肢は乱数の種を固定して作るので、何度実行しても同じ問題集になる。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "data/hyakumeizan.json"), "utf8"));
const PH = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pref-highest.json"), "utf8"));

/* ===== 乱数（種を固定） ===== */
let seed = 20261021;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a, n) => shuffle(a).slice(0, n);

/* ===== 地方 ===== */
const REGION = {};
[["北海道", "北海道"], ["東北", "青森県 岩手県 宮城県 秋田県 山形県 福島県"], ["関東", "茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県"],
 ["中部", "新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県"], ["近畿", "三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県"],
 ["中国", "鳥取県 島根県 岡山県 広島県 山口県"], ["四国", "徳島県 香川県 愛媛県 高知県"], ["九州・沖縄", "福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県"]]
  .forEach(([r, list]) => list.split(" ").forEach((p) => (REGION[p] = r)));
const ALL_PREFS = Object.keys(REGION);
const regionOf = (m) => REGION[m.prefs[0]];

/* ===== 表示名 ===== */
// 一覧の山名は『日本百名山』での表記。一般的な呼び名と違うものは、なじみのある名前で出題する
const DISPLAY = {
  "蔵王山": "蔵王山", "立山本峰": "立山", "大雪山": "大雪山", "悪沢岳": "荒川岳（悪沢岳）", "黒岳": "水晶岳（黒岳）"
};
H.forEach((m) => { m.disp = DISPLAY[m.name] || m.page || m.name; });
const byElevDesc = H.slice().sort((a, b) => b.elevation - a.elevation);
H.forEach((m) => { m.rank = byElevDesc.findIndex((x) => x.elevation === m.elevation) + 1; });

const park = (m) => m.notes.find((n) => /国立公園|国定公園/.test(n)) || null;
const nickname = (m) => m.notes.find((n) => /富士$/.test(n)) || null;
const highestOf = (m) => m.notes.filter((n) => /の最高峰$/.test(n));

const ODD_RANGES = new Set(["利尻島", "知床半島", "伊豆半島", "菅平高原", "えびの高原", "屋久島", "阿蘇カルデラ", "独立峰"]);
function explain(m) {
  const renamed = m.disp !== m.name && !m.disp.startsWith(m.name);
  const where = m.prefs.length > 1 ? `${m.prefs.join("・")}にまたがる` : `${m.prefs[0]}にある`;
  const kei = m.range === "独立峰" ? "独立峰" : ODD_RANGES.has(m.range) ? `山（山域：${m.range}）` : `${m.range}の山`;
  const parts = [`${m.disp}${renamed ? "" : `（${m.yomi}）`}は標高${m.elevation}m。${where}${kei}。`];
  if (park(m)) parts.push(`${park(m)}に含まれる。`);
  if (nickname(m)) parts.push(`「${nickname(m)}」とも呼ばれる。`);
  if (highestOf(m).length) parts.push(`${highestOf(m).join("・")}。`);
  if (m.notes.includes("氷河が現存")) parts.push("山中に現存する氷河がある。");
  parts.push(`日本百名山の中で標高${m.rank}位。`);
  if (renamed) parts.push(`（『日本百名山』での山名は「${m.name}（${m.yomi}）」）`);
  return parts.join("");
}

const questions = [];
let counter = 0;
function add(cat, q, answer, wrongs, explanation, extra = {}) {
  const uniq = [...new Set(wrongs.filter((w) => w !== answer))];
  if (uniq.length < 2) return; // 選択肢が作れない問題は出さない
  const choices = shuffle([answer, ...uniq.slice(0, 3)]);
  questions.push({ id: `${cat}-${String(++counter).padStart(3, "0")}`, cat, q, choices, answer: choices.indexOf(answer), explain: explanation, ...extra });
}

/* ===== ① 標高 ===== */
for (const m of H) {
  const near = H.filter((x) => x !== m && Math.abs(x.elevation - m.elevation) >= 40 && Math.abs(x.elevation - m.elevation) <= 500).map((x) => x.elevation);
  const wrong = [];
  for (const e of shuffle(near)) {
    if (wrong.every((w) => Math.abs(w - e) >= 40)) wrong.push(e);
    if (wrong.length === 3) break;
  }
  while (wrong.length < 3) { // 近い標高の山が少ないときは前後の値で補う
    const e = m.elevation + (rand() < 0.5 ? -1 : 1) * (60 + Math.round(rand() * 240));
    if ([m.elevation, ...wrong].every((w) => Math.abs(w - e) >= 40)) wrong.push(e);
  }
  add("elev", `${m.disp}の標高は？`, `${m.elevation}m`, wrong.map((e) => `${e}m`), explain(m));
}

/* ===== ② 都道府県 ===== */
for (const m of H) {
  const answer = m.prefs[Math.floor(rand() * m.prefs.length)];
  const sameRegion = ALL_PREFS.filter((p) => !m.prefs.includes(p) && REGION[p] === REGION[answer]);
  const near = ALL_PREFS.filter((p) => !m.prefs.includes(p) && !sameRegion.includes(p));
  const wrong = [...pick(sameRegion, 2), ...pick(near, 3)];
  const q = m.prefs.length > 1 ? `${m.disp}がある都道府県は？（いくつかの県にまたがる山です）` : `${m.disp}がある都道府県は？`;
  add("pref", q, answer, wrong, explain(m));
}

/* ===== ③ 読み方 ===== */
// 読み間違えやすい山は手書きの選択肢で
const TRICKY = {
  "皇海山": ["こうかいさん", "おうみさん", "すめらぎやま"],
  "武尊山": ["ぶそんさん", "たけるやま", "むそんざん"],
  "四阿山": ["しあさん", "よつあざん", "しくまやま"],
  "瑞牆山": ["ずいしょうざん", "みずかきさん", "ずいがきやま"],
  "光岳": ["ひかりだけ", "こうだけ", "みつだけ"],
  "聖岳": ["せいだけ", "しょうだけ", "きよしだけ"],
  "巻機山": ["けんきさん", "まききやま", "かんきざん"],
  "安達太良山": ["あだちたらさん", "あたたらさん", "あだたりやま"],
  "八幡平": ["やわたひら", "はちまんだいら", "やはただいら"],
  "美ヶ原": ["びがはら", "みがはら", "うつくしがわら"],
  "霧ヶ峰": ["むがみね", "きりがほう", "きりかね"],
  "恵那山": ["けいなざん", "めぐなさん", "えなせん"],
  "天城山": ["てんじょうざん", "あまきやま", "てんぎさん"],
  "祖母山": ["そもさん", "ばばやま", "おばやま"],
  "開聞岳": ["ひらききだけ", "かいぶんだけ", "あけもんだけ"],
  "御嶽山": ["ごがくさん", "ぎょがくさん", "おんだけざん"],
  "間ノ岳": ["まのだけ", "かんのだけ", "あいだのたけ"],
  "空木岳": ["そらきだけ", "くうぼくだけ", "からきだけ"],
  "至仏山": ["しふつざん", "じぶつやま", "いたぼとけやま"],
  "雨飾山": ["うしょくさん", "あめしきやま", "あまかざさん"],
  "剱岳": ["けんだけ", "けんがく", "たちだけ"],
  "大山": ["おおやま", "たいざん", "だいさん"],
  "月山": ["つきやま", "げつざん", "がっせん"],
  "早池峰": ["はやいけみね", "そうちほう", "はやちみね"],
  "鳳凰山": ["おおとりやま", "ほうこうざん", "ほうおうせん"],
  "白馬岳": ["はくばだけ", "しろまだけ", "はくまだけ"],
  "常念岳": ["つねねんだけ", "じょうねだけ", "とこねんだけ"],
  "黒部五郎岳": ["くろべごろだけ", "くろぶごろうだけ", "くろべいつろうだけ"],
  "両神山": ["りょうじんざん", "ふたがみやま", "もろかみさん"],
  "飯豊山": ["いいとよさん", "はんぽうざん", "めしとよやま"]
};
// それ以外は「読み → 山」の向きで出題（語尾の読みが複数通用する山があるため、読みの選択肢は作らない）
const MULTI_READING = new Set(["大雪山", "吾妻山", "赤城山", "会津駒ヶ岳", "蓼科山"]); // 別の読み方も広く使われる山
for (const m of H) {
  if (TRICKY[m.name]) {
    const label = m.name === "大山" ? "鳥取県の「大山」" : `「${m.name}」`;
    add("yomi", `${label}の読み方は？`, m.yomi, TRICKY[m.name], explain(m));
    continue;
  }
  if (MULTI_READING.has(m.name)) continue;
  const label = (x) => (x.disp.includes(x.name) ? x.disp : `${x.name}（現在の${x.disp}）`);
  const sameRegion = H.filter((x) => x !== m && regionOf(x) === regionOf(m));
  const wrong = [...pick(sameRegion, 3), ...pick(H.filter((x) => x !== m), 3)].map(label);
  add("yomi", `「${m.yomi}」と読む日本百名山は？`, label(m), wrong, explain(m));
}

/* ===== ④ 山系 ===== */
const RANGE_GROUPS = [
  ["飛騨山脈", "後立山連峰", "立山連峰", "常念山脈"], ["奥羽山脈", "那須連山"], ["越後山脈", "三国山脈"],
  ["頸城山塊", "戸隠連峰"], ["台高山脈", "紀伊山地"], ["日光連山", "足尾山地"], ["九重火山群", "九州山地"], ["出羽山地", "朝日山地"]
];
const sameGroup = (a, b) => a === b || RANGE_GROUPS.some((g) => g.includes(a) && g.includes(b));
const rangeLabel = (r) => (r === "独立峰" ? "独立峰（どの山脈にも属さない）" : r);
const RANGES = [...new Set(H.map((m) => m.range))].filter((r) => !ODD_RANGES.has(r));
for (const m of pick(H, 100).slice(0, 56)) {
  if (ODD_RANGES.has(m.range) && m.range !== "独立峰") continue;
  const region = regionOf(m);
  const pool = RANGES.filter((r) => !sameGroup(r, m.range));
  const near = pool.filter((r) => H.some((x) => x.range === r && regionOf(x) === region));
  const wrong = [...pick(near, 2), ...pick(pool.filter((r) => !near.includes(r)), 3)].map(rangeLabel);
  add("range", `${m.disp}が属する山系・山域は？`, rangeLabel(m.range), wrong, explain(m));
}

/* ===== ⑤ 国立公園・国定公園 ===== */
const PARKS = [...new Set(H.map(park).filter(Boolean))];
for (const m of pick(H, 100).slice(0, 55)) {
  const p = park(m);
  if (!p || m.notes.filter((n) => /公園/.test(n)).length > 1) continue;
  const kind = p.endsWith("国立公園") ? "国立公園" : "国定公園";
  const wrong = pick(PARKS.filter((x) => x !== p && x.endsWith(kind)), 3);
  add("park", `${m.disp}がある${kind}は？`, p, wrong, explain(m));
}

/* ===== ⑥ 高さくらべ ===== */
function spreadSet(n, minGap) {
  for (let t = 0; t < 200; t++) {
    const s = pick(H, n);
    const e = s.map((m) => m.elevation).sort((a, b) => a - b);
    if (e.every((v, i) => i === 0 || v - e[i - 1] >= minGap)) return s;
  }
  return null;
}
const usedSets = new Set();
for (let i = 0; i < 40; i++) {
  const high = i < 26;
  const s = spreadSet(4, 30);
  if (!s) continue;
  const key = s.map((m) => m.no).sort().join(",");
  if (usedSets.has(key)) continue;
  usedSets.add(key);
  const sorted = s.slice().sort((a, b) => b.elevation - a.elevation);
  const ans = high ? sorted[0] : sorted[sorted.length - 1];
  add("compare", high ? "次のうち、いちばん標高が高い山は？" : "次のうち、いちばん標高が低い山は？",
    ans.disp, s.filter((m) => m !== ans).map((m) => m.disp),
    `${sorted.map((m) => `${m.disp} ${m.elevation}m`).join(" ＞ ")}。`);
}

/* ===== ⑦ この県にある山は？ ===== */
const prefsWithMountains = ALL_PREFS.filter((p) => H.some((m) => m.prefs.includes(p)));
for (const p of prefsWithMountains) {
  const inPref = H.filter((m) => m.prefs.includes(p));
  const times = inPref.length >= 8 ? 3 : inPref.length >= 3 ? 2 : 1;
  pick(inPref, times).forEach((ans) => {
    const others = H.filter((m) => !m.prefs.includes(p));
    const near = others.filter((m) => regionOf(m) === REGION[p]);
    const wrong = [...pick(near, 2), ...pick(others.filter((m) => !near.includes(m)), 3)].map((m) => m.disp);
    add("where", `次のうち、${p}にある日本百名山は？`, ans.disp, wrong, explain(ans));
  });
}

/* ===== ⑧ 都道府県の最高峰 ===== */
const phName = (x) => (x.peak && x.name !== "立山" ? `${x.name}（${x.peak}）` : x.name);
const EXCLUDE_WRONG = { "秋田県": ["鳥海山"] }; // 秋田県の最高地点は鳥海山の中腹にあるため選択肢から外す
for (const x of PH) {
  const pool = PH.filter((y) => y.name !== x.name && !(EXCLUDE_WRONG[x.pref] || []).includes(y.name));
  const near = pool.filter((y) => REGION[y.pref] === REGION[x.pref]);
  const inside = H.filter((m) => m.prefs.includes(x.pref) && m.disp !== x.name && m.name !== x.name && !(EXCLUDE_WRONG[x.pref] || []).includes(m.disp)).map((m) => m.disp);
  const wrong = [...new Set([...pick(inside, 2), ...pick(near, 2).map((y) => y.name), ...pick(pool, 3).map((y) => y.name)])];
  const peakNote = x.peak ? `（最高点は${x.peak}）` : "";
  add("highest", `${x.pref}の最高峰は？`, x.name, wrong,
    `${x.pref}の最高峰は${x.name}${x.yomi ? `（${x.yomi}）` : ""}${peakNote}、標高${x.elevation}m。${x.range && x.range !== "独立峰" ? `${x.range}の山。` : ""}${x.pref === "秋田県" ? "なお秋田県内の最高地点は、山頂が山形県側にある鳥海山の中腹（約1775m）。" : ""}${x.pref === "千葉県" ? "全国の都道府県の最高峰でいちばん低い。" : ""}`);
}

/* ===== ⑨ 山の知識（手書き） ===== */
const GENERAL = [
  ["日本でいちばん高い山は？", "富士山", ["北岳", "奥穂高岳", "槍ヶ岳"], "富士山（3776m）が日本最高峰。2位は南アルプスの北岳（3193m）。"],
  ["日本で2番目に高い山は？", "北岳", ["奥穂高岳", "間ノ岳", "槍ヶ岳"], "2位は北岳（3193m）。奥穂高岳と間ノ岳がともに3190mで続く。"],
  ["富士山の標高は？", "3776m", ["3767m", "3667m", "3876m"], "富士山は3776m（みななろう、と覚える人も）。最高地点は剣ヶ峰。"],
  ["『日本百名山』を書いたのは？", "深田久弥", ["田中澄江", "新田次郎", "井上靖"], "深田久弥が自ら登った山から100座を選んだ山岳随筆集。1964年刊行。"],
  ["『花の百名山』を書いたのは？", "田中澄江", ["深田久弥", "串田孫一", "新田次郎"], "田中澄江が花の美しい山を紹介した随筆集。"],
  ["『日本百名山』が刊行されたのは？", "1964年", ["1955年", "1972年", "1981年"], "1964年（昭和39年）に新潮社から刊行され、翌年に読売文学賞を受賞した。"],
  ["北アルプスの正式な山脈名は？", "飛騨山脈", ["木曽山脈", "赤石山脈", "越後山脈"], "北アルプス＝飛騨山脈、中央アルプス＝木曽山脈、南アルプス＝赤石山脈。"],
  ["中央アルプスの正式な山脈名は？", "木曽山脈", ["飛騨山脈", "赤石山脈", "三国山脈"], "中央アルプスは木曽山脈。主峰は木曽駒ヶ岳（2956m）。"],
  ["南アルプスの正式な山脈名は？", "赤石山脈", ["木曽山脈", "飛騨山脈", "奥羽山脈"], "南アルプスは赤石山脈。日本2位の北岳がある。"],
  ["「日本アルプス」と名付けたイギリス人は？", "ウィリアム・ガウランド", ["ウォルター・ウェストン", "アーネスト・サトウ", "ジョン・ミルン"], "名付けたのは鉱山技師のガウランド。ウェストンはその名を世界に広めた。"],
  ["「日本近代登山の父」と呼ばれ、上高地にレリーフがあるイギリス人宣教師は？", "ウォルター・ウェストン", ["ウィリアム・ガウランド", "アーネスト・サトウ", "トーマス・グラバー"], "ウェストンは日本アルプスを広く紹介した。上高地では毎年ウェストン祭が開かれる。"],
  ["標高が100m上がると、気温はおよそ何℃下がる？", "約0.6℃", ["約0.1℃", "約1.5℃", "約3℃"], "平均的には100mで約0.6℃下がる。標高3000mの山頂は麓より約18℃低い計算。"],
  ["高い山で樹木が育たなくなる境界を何という？", "森林限界", ["雪線", "分水嶺", "等高線"], "本州中部ではおよそ2500m前後。ここから上が高山植物の世界。"],
  ["氷河が削ってできた、お椀のような形の谷を何という？", "カール（圏谷）", ["カルデラ", "扇状地", "V字谷"], "千畳敷カール（木曽駒ヶ岳）や涸沢カール（穂高岳）が有名。"],
  ["火山の噴火や陥没でできた大きなくぼ地を何という？", "カルデラ", ["カール", "ドリーネ", "モレーン"], "阿蘇山のカルデラは世界有数の大きさ。"],
  ["夏になっても雪が残っている谷を何という？", "雪渓", ["雪庇", "雪崩", "樹氷"], "白馬岳の白馬大雪渓が有名。落石やクレバスに注意。"],
  ["稜線の風下側に、ひさしのように張り出した雪を何という？", "雪庇", ["雪渓", "シュカブラ", "モンスター"], "踏み抜くと崩れて転落するおそれがあるので、稜線の端に近づかない。"],
  ["山頂や分岐の目印として石を積み上げたものは？", "ケルン", ["ピッケル", "カラビナ", "ザイル"], "道迷いを防ぐ目印。むやみに崩したり積んだりしない。"],
  ["地図で同じ高さの地点を結んだ線は？", "等高線", ["経線", "稜線", "尾根線"], "間隔がせまいほど急な斜面。"],
  ["2万5千分の1地形図で、細い等高線（主曲線）は何mごと？", "10m", ["5m", "20m", "50m"], "主曲線は10mごと、太い計曲線は50mごと。"],
  ["山頂などに設置され、測量の基準になる石の標識は？", "三角点", ["道標", "ケルン", "道祖神"], "国土地理院が設置する基準点。山頂にあることが多い。"],
  ["高山病のおもな原因は？", "酸素が薄いこと", ["紫外線が強いこと", "気温が低いこと", "湿度が低いこと"], "標高が上がって酸素が少なくなるのが原因。ゆっくり登り、水分をとるのが予防の基本。"],
  ["登山計画書（登山届）を出すおもな目的は？", "遭難したときの捜索・救助に役立てるため", ["入山料を払うため", "山小屋を予約するため", "天気予報を受け取るため"], "行き先や日程を家族や警察などに知らせておくと、万一のとき早く探してもらえる。"],
  ["登山道で登りの人と下りの人がすれ違うとき、基本的に優先されるのは？", "登りの人", ["下りの人", "年上の人", "人数が多いほう"], "登りは呼吸のリズムが崩れやすいため、登り優先が基本のマナー（状況に応じて譲り合う）。"],
  ["山で雷の音が聞こえたら、まずどうする？", "すぐに山小屋などの安全な場所へ避難する", ["高い木の下で雨宿りする", "見晴らしのいい尾根に出る", "その場で傘をさして待つ"], "木の下は側撃雷の危険がある。稜線や山頂からは早めに離れる。"],
  ["汗や雨で濡れても体を冷やしにくい肌着の素材は？", "化学繊維やウール", ["綿（コットン）", "麻", "デニム"], "綿は乾きにくく、濡れると体温を奪い低体温症の原因になる。"],
  ["日本三霊山（日本三名山）は富士山・白山と、あとひとつは？", "立山", ["御嶽山", "大山", "石鎚山"], "富士山・白山・立山が日本三霊山とされる。"],
  ["日本百名山でいちばん標高が低い山は？", "筑波山", ["開聞岳", "伊吹山", "天城山"], "筑波山（877m）が最も低い。次が開聞岳（924m）。"],
  ["日本百名山でいちばん北にある山は？", "利尻山", ["羅臼岳", "大雪山", "斜里岳"], "利尻島の利尻山（利尻岳）。百名山の1番目。"],
  ["日本百名山でいちばん南にある山は？", "宮之浦岳", ["開聞岳", "霧島山", "祖母山"], "屋久島の宮之浦岳（1936m）。九州の最高峰でもある。"],
  ["剱岳の測量を描いた新田次郎の小説は？", "『劔岳 点の記』", ["『孤高の人』", "『氷壁』", "『神々の山嶺』"], "明治40年、陸地測量部の測量隊が剱岳に登り三角点を設けるまでを描いた。映画にもなった。"],
  ["小説『氷壁』の作者は？", "井上靖", ["新田次郎", "夢枕獏", "深田久弥"], "ナイロンザイル切断事件をもとにした山岳小説。舞台は穂高。"],
  ["富士山が世界文化遺産に登録された年は？", "2013年", ["2007年", "2010年", "2016年"], "「富士山－信仰の対象と芸術の源泉」として2013年に登録。"],
  ["屋久島が世界自然遺産に登録された年は？", "1993年", ["2005年", "2011年", "1999年"], "白神山地とともに日本で初めての世界自然遺産になった。"],
  ["知床が世界自然遺産に登録された年は？", "2005年", ["1993年", "2011年", "2021年"], "羅臼岳や知床連山を含む知床半島一帯が登録された。"],
  ["国民の祝日「山の日」は？", "8月11日", ["7月20日", "8月1日", "10月10日"], "2016年から施行された祝日。「山に親しむ機会を得て、山の恩恵に感謝する」日。"],
  ["上高地を流れる川は？", "梓川", ["黒部川", "千曲川", "天竜川"], "梓川にかかる河童橋から穂高連峰を望むのが上高地の定番の景色。"],
  ["気象庁が選定している日本の活火山の数は？", "111", ["47", "86", "200"], "現在111の火山が活火山とされている。登る前に噴火警戒レベルを確認しよう。"],
  ["2014年9月に噴火し、多くの登山者が犠牲になった山は？", "御嶽山", ["浅間山", "草津白根山", "新燃岳"], "紅葉シーズンの昼前に噴火した。火山に登るときは火山情報と避難場所を確認しておく。"],
  ["火山の「噴火警戒レベル」を発表するのは？", "気象庁", ["国土地理院", "環境省", "消防庁"], "レベル1〜5で、立入規制の範囲などの目安になる。"],
  ["国立公園を指定するのは？", "環境大臣（環境省）", ["国土交通大臣", "農林水産大臣", "文部科学大臣"], "国定公園は都道府県の申し出により環境大臣が指定する。"],
  ["山頂などで見る日の出を何という？", "ご来光", ["ご来迎", "朝焼け", "彩雲"], "山小屋に泊まって山頂でご来光を迎えるのは山の楽しみのひとつ。"],
  ["太陽を背にしたとき、霧に映った自分の影のまわりに虹色の輪が見える現象は？", "ブロッケン現象", ["蜃気楼", "彩雲", "ダイヤモンドダスト"], "昔は「御来迎（ごらいごう）」とも呼ばれた。"],
  ["凍った雪や氷の上で滑らないよう、登山靴に付ける爪は？", "アイゼン（クランポン）", ["ピッケル", "スパッツ", "カラビナ"], "冬山や残雪期の必需品。"],
  ["山で「ガスってきた」といえば？", "霧（雲）がかかってきた", ["燃料が切れた", "おなかがすいた", "雷が鳴り出した"], "視界が悪くなるので、道迷いに注意。"],
  ["岩場で、両手両足のうち3点で体を支えて1点ずつ動かす基本を何という？", "三点支持", ["三点倒立", "三点確保ロープ", "三歩一休"], "岩場やはしごでの転落を防ぐ基本動作。"],
  ["八ヶ岳の最高峰は？", "赤岳", ["硫黄岳", "天狗岳", "横岳"], "赤岳（2899m）。八ヶ岳は単独の山ではなく連峰の総称。"],
  ["穂高連峰の最高峰は？", "奥穂高岳", ["北穂高岳", "前穂高岳", "西穂高岳"], "奥穂高岳（3190m）は日本3位の高峰。"],
  ["立山の最高地点は？", "大汝山", ["雄山", "富士ノ折立", "別山"], "立山の最高点は大汝山（3015m）。神社のある雄山（3003m）を山頂と思われがち。"],
  ["白山の最高峰は？", "御前峰", ["大汝峰", "剣ヶ峰", "別山"], "御前峰（2702m）。山頂には白山比咩神社の奥宮がある。"],
  ["鳥海山の最高峰は？", "新山", ["七高山", "月山", "笙ヶ岳"], "新山（2236m）。山頂は山形県側にある。"],
  ["石鎚山の最高峰は？", "天狗岳", ["弥山", "南尖峰", "二ノ森"], "天狗岳（1982m）が西日本の最高峰。石鎚神社の頂上社は弥山にある。"],
  ["燧ヶ岳の最高峰は？", "柴安嵓", ["俎嵓", "赤ナグレ岳", "ミノブチ岳"], "柴安嵓（しばやすぐら・2356m）。東北地方の最高峰でもある。"],
  ["大峰山（大峰山脈）の最高峰は？", "八経ヶ岳", ["山上ヶ岳", "弥山", "釈迦ヶ岳"], "八経ヶ岳（八剣山・1915m）は近畿地方の最高峰。"],
  ["九重山（くじゅう連山）の最高峰は？", "中岳", ["久住山", "大船山", "星生山"], "中岳（1791m）は九州本土の最高峰。久住山（1787m）よりわずかに高い。"],
  ["大雪山の最高峰は？", "旭岳", ["黒岳", "白雲岳", "北鎮岳"], "旭岳（2291m）は北海道の最高峰。"],
  ["富士山の最高地点は？", "剣ヶ峰", ["白山岳", "久須志岳", "大日岳"], "剣ヶ峰（3776m）。かつて富士山測候所があった。"],
  ["鳥取県の大山の最高点は？", "剣ヶ峰", ["弥山", "三鈷峰", "天狗ヶ峰"], "最高点は剣ヶ峰（1729m）。一般の登山道の山頂は弥山（1709m）。"],
  ["蔵王連峰の宮城県側にある最高峰で、宮城県の最高峰でもある山は？", "屏風岳", ["熊野岳", "刈田岳", "不忘山"], "屏風岳（1825m）。蔵王連峰全体の最高峰は山形県の熊野岳。"],
  ["日本の都道府県の最高峰で、いちばん低いのは？", "愛宕山（千葉県）", ["於茂登岳（沖縄県）", "大和葛城山（大阪府）", "皆子山（京都府）"], "千葉県の愛宕山（408m）。沖縄県の於茂登岳は526m。"],
  ["本州最大級の高層湿原が広がる、群馬・福島・新潟にまたがる地域は？", "尾瀬", ["上高地", "美ヶ原", "霧ヶ峰"], "尾瀬ヶ原は本州最大の高層湿原。至仏山と燧ヶ岳に挟まれている。"]
];
GENERAL.forEach(([q, a, w, e]) => add("general", q, a, w, e));

/* ===== 出力 ===== */
const CAT_LABEL = { elev: "標高", pref: "都道府県", yomi: "読み方", range: "山系", park: "国立・国定公園", compare: "高さくらべ", where: "この県の山は？", highest: "都道府県の最高峰", general: "山の知識" };
const out = { generated: "日本百名山・各都道府県の最高峰（Wikipedia）ほかから生成", categories: CAT_LABEL, questions };
fs.writeFileSync(path.join(ROOT, "data/mountain-quiz.json"), JSON.stringify(out) + "\n");
const counts = {};
questions.forEach((q) => (counts[q.cat] = (counts[q.cat] || 0) + 1));
console.log("total", questions.length, counts);
