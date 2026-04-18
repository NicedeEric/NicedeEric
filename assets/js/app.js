/**
 * 王者测试 · Frontend quiz logic
 *  - loads ./data/questions.json and ./data/heroes.json
 *  - drives intro → quiz → loading → result screens
 *  - scoring: sum weights from chosen options into a 6-dim user vector,
 *             then cosine-similarity match against every hero vector
 *  - reports anonymous visits + final hero via WzryAPI
 */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const DIMS = ["A", "D", "T", "L", "S", "I"];
  const DIM_LABELS = { A: "攻击", D: "防御", T: "团队", L: "独行", S: "智谋", I: "直觉" };

  const LETTERS = ["A", "B", "C", "D"];
  const screens = {
    intro: $("#screen-intro"),
    quiz: $("#screen-quiz"),
    loading: $("#screen-loading"),
    result: $("#screen-result"),
  };

  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ---- state ----
  let QUESTIONS = [];
  let HEROES = [];
  let answers = []; // index per question (0..3)
  let currentQ = 0;

  // ---- init ----
  async function init() {
    // fire analytics tracking but don't block UI on it
    if (window.WzryAPI && WzryAPI.configured) {
      WzryAPI.trackVisit("/");
      WzryAPI.getPublicStats().then(s => {
        if (s && typeof s.total === "number") $("#statTotal").textContent = s.total.toLocaleString();
      });
    } else {
      $("#statTotal").textContent = "—";
    }

    try {
      const [q, h] = await Promise.all([
        fetch("./data/questions.json").then(r => r.json()),
        fetch("./data/heroes.json").then(r => r.json()),
      ]);
      QUESTIONS = q.questions;
      HEROES = h.heroes;
      $("#qTotal").textContent = QUESTIONS.length;
    } catch (e) {
      alert("题库加载失败，请刷新重试。\n" + e);
      return;
    }

    // ---- events ----
    $("#btnStart").addEventListener("click", startQuiz);
    $("#btnBack").addEventListener("click", goBack);
    $("#btnRetry").addEventListener("click", () => { answers = []; currentQ = 0; show("intro"); });
    $("#btnShare").addEventListener("click", shareResult);

    // deep link (?r=heroId) → show result directly, for shared links
    const sp = new URLSearchParams(location.search);
    if (sp.has("r")) {
      const hid = sp.get("r");
      const hero = HEROES.find(h => h.id === hid);
      if (hero) renderResult(hero, [], computeZeroScores(), true);
    }
  }

  // ---- quiz flow ----
  function startQuiz() {
    answers = [];
    currentQ = 0;
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[currentQ];
    $("#qIndex").textContent = currentQ + 1;
    $("#qIndex2").textContent = currentQ + 1;
    $("#qText").textContent = q.q;
    $("#progressFill").style.width = ((currentQ) / QUESTIONS.length * 100) + "%";
    $("#btnBack").style.visibility = currentQ === 0 ? "hidden" : "visible";

    const wrap = $("#qOptions");
    wrap.innerHTML = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "q-opt";
      btn.dataset.letter = LETTERS[i];
      btn.textContent = opt.text;
      if (answers[currentQ] === i) btn.classList.add("selected");
      btn.addEventListener("click", () => selectOption(i));
      wrap.appendChild(btn);
    });
  }

  function selectOption(idx) {
    answers[currentQ] = idx;
    // visual feedback
    $$(".q-opt").forEach((el, i) => el.classList.toggle("selected", i === idx));
    // advance
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        currentQ++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 220);
  }

  function goBack() {
    if (currentQ > 0) {
      currentQ--;
      renderQuestion();
    }
  }

  function finishQuiz() {
    show("loading");
    $("#progressFill").style.width = "100%";
    setTimeout(() => {
      const userVec = scoreUser(answers);
      const matches = rankHeroes(userVec);
      const top = matches[0].hero;
      if (window.WzryAPI && WzryAPI.configured) WzryAPI.trackResult(top.id, userVec);
      renderResult(top, matches, userVec, false);
    }, 1100);
  }

  // ---- scoring ----
  function computeZeroScores() { return DIMS.reduce((o, d) => (o[d] = 0, o), {}); }

  function scoreUser(ans) {
    const vec = computeZeroScores();
    ans.forEach((optIdx, qi) => {
      const w = QUESTIONS[qi].options[optIdx].w || {};
      DIMS.forEach(d => { if (w[d]) vec[d] += w[d]; });
    });
    return vec;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    DIMS.forEach(d => {
      const x = a[d] || 0, y = b[d] || 0;
      dot += x * y;
      na += x * x;
      nb += y * y;
    });
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function rankHeroes(userVec) {
    return HEROES
      .map(h => ({ hero: h, score: cosine(userVec, h.vec) }))
      .sort((a, b) => b.score - a.score);
  }

  // ---- result render ----
  function renderResult(hero, matches, userVec, isSharedLink) {
    show("result");
    $("#resRole").textContent = hero.role + " · " + hero.lane;
    $("#resName").textContent = hero.name;
    $("#resTitle").textContent = hero.title;
    $("#resQuote").textContent = "「" + hero.quote + "」";
    $("#resDesc").textContent = hero.desc;
    $("#resultBanner").style.setProperty("--hero-color", hero.color || "#7F5AF0");

    const traits = $("#resTraits");
    traits.innerHTML = "";
    (hero.traits || []).forEach(t => {
      const tag = document.createElement("span");
      tag.className = "trait-tag";
      tag.textContent = t;
      traits.appendChild(tag);
    });

    // top3 excluding the main hero
    const top3 = $("#resTop3");
    top3.innerHTML = "";
    if (matches && matches.length > 0) {
      matches.slice(1, 4).forEach(m => {
        const el = document.createElement("div");
        el.className = "top3-item";
        el.innerHTML = `<div class="top3-item-name">${m.hero.name}</div>
                        <div class="top3-item-score">匹配 ${(m.score * 100).toFixed(1)}%</div>`;
        top3.appendChild(el);
      });
    } else {
      top3.innerHTML = '<div class="top3-item">分享的结果无 top3 数据</div>';
    }

    // radar chart
    drawRadar(userVec);

    // push history state with shareable link
    try {
      const u = new URL(location.href);
      u.searchParams.set("r", hero.id);
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  // ---- radar chart (canvas) ----
  function drawRadar(vec) {
    const canvas = $("#radar");
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = 300, H = 300;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2, R = 100;
    const N = DIMS.length;
    const maxVal = Math.max(1, ...DIMS.map(d => vec[d] || 0));

    // rings
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI / N);
        const r = R * ring / 4;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.stroke();
    }
    // axes
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI / N);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.stroke();
    }
    // shape
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI / N);
      const val = (vec[DIMS[i]] || 0) / maxVal;
      const x = cx + Math.cos(ang) * R * val;
      const y = cy + Math.sin(ang) * R * val;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, "rgba(127,90,240,.55)");
    grad.addColorStop(1, "rgba(255,209,102,.55)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,209,102,.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // dots
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI / N);
      const val = (vec[DIMS[i]] || 0) / maxVal;
      const x = cx + Math.cos(ang) * R * val;
      const y = cy + Math.sin(ang) * R * val;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd166";
      ctx.fill();
    }

    // labels
    ctx.fillStyle = "#c9bfe0";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI / N);
      const lx = cx + Math.cos(ang) * (R + 18);
      const ly = cy + Math.sin(ang) * (R + 18);
      ctx.fillText(DIM_LABELS[DIMS[i]], lx, ly);
    }
  }

  // ---- share ----
  function shareResult() {
    const u = location.href;
    const name = $("#resName").textContent;
    const text = `我的王者测试结果是：${name}！来测测你是谁？`;
    if (navigator.share) {
      navigator.share({ title: "王者测试", text, url: u }).catch(() => copyToClipboard(u, text));
    } else {
      copyToClipboard(u, text);
    }
  }
  function copyToClipboard(url, text) {
    const full = text + " " + url;
    try {
      navigator.clipboard.writeText(full);
      alert("链接已复制到剪贴板，快去分享吧！");
    } catch (e) {
      prompt("复制以下链接分享：", full);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
