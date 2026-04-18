/**
 * 古今英雄测 · Frontend v4
 *  - 8D bipolar personality scoring
 *  - no hero images — calligraphy-style card only
 *  - per-dimension bar display with evaluation sentences
 *  - ~80 question pool, 30 sampled per test
 *  - restart button, animated background, share-as-image with QR
 */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const DIM_IDS = ["F", "G", "W", "Y", "K", "R", "Z", "M"];
  const SAMPLE_SIZE = 30;
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
  let POOL = [];
  let QUESTIONS = [];
  let HEROES = [];
  let DIMS = [];             // full dimension definitions
  let answers = [];
  let currentQ = 0;
  let lastResult = null;

  function randomSample(arr, n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  // ==========================================================
  //  Particle background
  // ==========================================================
  function startParticles() {
    const canvas = $("#bgParticles");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h;
    const particles = [];
    const COUNT = window.innerWidth < 600 ? 25 : 45;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.8 + 0.4,
        hue: Math.random() < 0.6 ? "rgba(255,209,102," : "rgba(179,136,255,",
        a: Math.random() * 0.6 + 0.2,
      });
    }

    function loop() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, p.hue + p.a + ")");
        grad.addColorStop(1, p.hue + "0)");
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = p.hue + "0.9)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  function animateCounter(el, target) {
    if (!el) return;
    const duration = 1200;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.floor(target * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    if (target > 0) requestAnimationFrame(step);
    else el.textContent = "—";
  }

  // ==========================================================
  //  Init
  // ==========================================================
  async function init() {
    startParticles();

    if (window.WzryAPI && WzryAPI.configured) {
      WzryAPI.trackVisit("/");
      WzryAPI.getPublicStats().then(s => {
        if (s && typeof s.total === "number") animateCounter($("#statTotal"), s.total);
      });
    } else {
      $("#statTotal").textContent = "—";
    }

    try {
      const [q, h] = await Promise.all([
        fetch("./data/questions.json").then(r => r.json()),
        fetch("./data/heroes.json").then(r => r.json()),
      ]);
      POOL = q.questions;
      HEROES = h.heroes;
      DIMS = h.dimensions;
    } catch (e) {
      alert("题库加载失败，请刷新重试。\n" + e);
      return;
    }

    animateCounter($("#statQuestions"), POOL.length);
    animateCounter($("#statHeroes"), HEROES.length);

    $("#btnStart").addEventListener("click", startQuiz);
    $("#btnBack").addEventListener("click", goBack);
    $("#btnRestart").addEventListener("click", openRestartConfirm);
    $("#btnConfirmCancel").addEventListener("click", closeRestartConfirm);
    $("#btnConfirmOK").addEventListener("click", confirmRestart);
    $("#btnRetry").addEventListener("click", () => {
      answers = []; currentQ = 0;
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      show("intro");
    });
    $("#btnShare").addEventListener("click", generateShareImage);
    $("#btnSharePreviewClose").addEventListener("click", closeSharePreview);
    $("#btnShareDownload").addEventListener("click", downloadShareImage);
    $("#btnShareSystem").addEventListener("click", systemShare);

    const sp = new URLSearchParams(location.search);
    if (sp.has("r")) {
      const hid = sp.get("r");
      const hero = HEROES.find(h => h.id === hid);
      if (hero) renderResult(hero, neutralUserVec(), 0.7);
    }
  }

  // ==========================================================
  //  Quiz flow
  // ==========================================================
  function startQuiz() {
    QUESTIONS = randomSample(POOL, Math.min(SAMPLE_SIZE, POOL.length));
    answers = [];
    currentQ = 0;
    $("#qTotal").textContent = QUESTIONS.length;
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
      btn.addEventListener("click", (e) => {
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty("--ripple-x", ((e.clientX - rect.left) / rect.width * 100) + "%");
        btn.style.setProperty("--ripple-y", ((e.clientY - rect.top) / rect.height * 100) + "%");
        selectOption(i);
      });
      wrap.appendChild(btn);
    });
  }

  function selectOption(idx) {
    answers[currentQ] = idx;
    $$(".q-opt").forEach((el, i) => el.classList.toggle("selected", i === idx));
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        currentQ++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 260);
  }

  function goBack() {
    if (currentQ > 0) { currentQ--; renderQuestion(); }
  }

  function openRestartConfirm() { $("#confirmModal").classList.add("active"); }
  function closeRestartConfirm() { $("#confirmModal").classList.remove("active"); }
  function confirmRestart() {
    closeRestartConfirm();
    answers = []; currentQ = 0; QUESTIONS = [];
    show("intro");
  }

  function finishQuiz() {
    show("loading");
    $("#progressFill").style.width = "100%";
    setTimeout(() => {
      const userVec = scoreUser(answers);
      const { hero, matchScore } = findBestHero(userVec);
      if (window.WzryAPI && WzryAPI.configured) WzryAPI.trackResult(hero.id, userVec);
      renderResult(hero, userVec, matchScore);
    }, 1400);
  }

  // ==========================================================
  //  Scoring (8D bipolar)
  // ==========================================================
  function neutralUserVec() {
    const v = {};
    DIM_IDS.forEach(d => v[d] = 5);
    return v;
  }

  // User raw sum → scaled to 0-10 scale (centered at 5)
  function scoreUser(ans) {
    const raw = {};
    DIM_IDS.forEach(d => raw[d] = 0);
    ans.forEach((optIdx, qi) => {
      const w = QUESTIONS[qi].options[optIdx].w || {};
      DIM_IDS.forEach(d => { if (w[d] != null) raw[d] += w[d]; });
    });
    // scale factor: tuned so 30 questions with avg weight ~1.5 give meaningful 0-10 range
    // raw can go ±20ish, map to ±5 via /4, clamp
    const out = {};
    DIM_IDS.forEach(d => {
      const v = 5 + raw[d] / 4;
      out[d] = Math.max(0, Math.min(10, v));
    });
    return out;
  }

  // Manhattan distance, then converted to "match score" 0-1
  function findBestHero(userVec) {
    let best = null, bestDist = Infinity;
    for (const h of HEROES) {
      let dist = 0;
      for (const d of DIM_IDS) dist += Math.abs(userVec[d] - h.vec[d]);
      if (dist < bestDist) { bestDist = dist; best = h; }
    }
    // max possible distance = 8 * 10 = 80
    const matchScore = 1 - bestDist / 80;
    return { hero: best, matchScore };
  }

  // ==========================================================
  //  Result render
  // ==========================================================
  function renderResult(hero, userVec, matchScore) {
    lastResult = { hero, userVec, matchScore };
    show("result");

    $("#resEra").textContent = hero.era || "英雄";
    $("#resName .name-char").textContent = hero.name;
    $("#matchName").textContent = hero.name;
    $("#resTitle").textContent = hero.title;
    $("#resRole").textContent = (hero.role || "") + (hero.era ? "  ·  " + hero.era : "");
    $("#resQuote").textContent = "「" + hero.quote + "」";
    $("#resLore").textContent = hero.lore;
    $("#resPersonality").textContent = hero.personality;

    $("#matchValue").textContent = (matchScore * 100).toFixed(1) + " %";

    // hero color on the card border
    const card = $("#heroCard");
    if (hero.color) card.style.background = `linear-gradient(135deg, ${hex2rgba(hero.color, .4)}, rgba(127,90,240,.2), ${hex2rgba(hero.color, .4)})`;

    // traits
    const traits = $("#resTraits");
    traits.innerHTML = "";
    (hero.traits || []).forEach(t => {
      const tag = document.createElement("span");
      tag.className = "trait-tag";
      tag.textContent = t;
      traits.appendChild(tag);
    });

    // match reasons
    const matchList = $("#resMatch");
    matchList.innerHTML = "";
    (hero.matches_you_if || []).forEach(m => {
      const li = document.createElement("li");
      li.textContent = m;
      matchList.appendChild(li);
    });

    // 8 dimensions
    renderDims(userVec);

    try {
      const u = new URL(location.href);
      u.searchParams.set("r", hero.id);
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  function renderDims(userVec) {
    const wrap = $("#dimsWrap");
    wrap.innerHTML = "";
    DIMS.forEach(dim => {
      const id = dim.id;
      const v = userVec[id];                // 0-10
      const leftActive = v < 4.3;
      const rightActive = v > 5.7;
      const pctFromLeft = (v / 10) * 100;

      // which pole leans, pick eval sentence
      let evalLine;
      if (leftActive) {
        const strength = v < 2 ? "极度" : (v < 3.5 ? "明显" : "偏");
        evalLine = `${strength}${dim.left.name}向 · ${dim.left.desc}`;
      } else if (rightActive) {
        const strength = v > 8 ? "极度" : (v > 6.5 ? "明显" : "偏");
        evalLine = `${strength}${dim.right.name}向 · ${dim.right.desc}`;
      } else {
        evalLine = `${dim.left.name}${dim.right.name}兼备，平衡得宜`;
      }

      const row = document.createElement("div");
      row.className = "dim-row";
      row.innerHTML = `
        <div class="dim-labels">
          <span class="dim-label-left ${leftActive ? 'active' : ''}">${dim.left.name}</span>
          <span class="dim-label-name">${dim.name}</span>
          <span class="dim-label-right ${rightActive ? 'active' : ''}">${dim.right.name}</span>
        </div>
        <div class="dim-bar">
          <div class="dim-marker" style="left: ${pctFromLeft}%"></div>
        </div>
        <div class="dim-eval"><span class="dim-score">${v.toFixed(1)}</span>${evalLine}</div>
      `;
      wrap.appendChild(row);
    });
  }

  function hex2rgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ==========================================================
  //  Share image
  // ==========================================================
  let sharedImageDataUrl = null;

  async function generateShareImage() {
    if (!lastResult) return;
    const { hero, userVec } = lastResult;

    $("#shareEra").textContent = hero.era || "";
    $("#shareName").textContent = hero.name;
    $("#shareTitle").textContent = hero.title;
    $("#shareRole").textContent = (hero.era || "") + " · " + (hero.role || "");
    $("#shareQuote").textContent = "「" + hero.quote + "」";
    $("#shareDesc").textContent = hero.personality;

    const shareTraits = $("#shareTraits");
    shareTraits.innerHTML = "";
    (hero.traits || []).forEach(t => {
      const tag = document.createElement("span");
      tag.className = "trait-tag";
      tag.textContent = t;
      shareTraits.appendChild(tag);
    });

    // 8 dims summary
    const shareDims = $("#shareDims");
    shareDims.innerHTML = "";
    DIMS.forEach(dim => {
      const v = userVec[dim.id];
      let lean;
      if (v < 4) lean = dim.left.name;
      else if (v > 6) lean = dim.right.name;
      else lean = "兼";
      const row = document.createElement("div");
      row.className = "share-dim-row";
      row.innerHTML = `
        <span class="share-dim-poles">${dim.left.name} — ${dim.name} — ${dim.right.name}</span>
        <span class="share-dim-lean">${lean} · ${v.toFixed(1)}</span>
      `;
      shareDims.appendChild(row);
    });

    // QR code → homepage
    const qrContainer = $("#shareQr");
    qrContainer.innerHTML = "";
    const homeUrl = location.origin + location.pathname.replace(/index\.html$/i, "");
    new QRCode(qrContainer, {
      text: homeUrl,
      width: 140, height: 140,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    // show offscreen so html2canvas can render
    const node = $("#shareCanvas");
    node.style.left = "0"; node.style.top = "0";
    node.style.zIndex = "-1"; node.style.opacity = "0";

    await new Promise(r => setTimeout(r, 100));

    const btn = $("#btnShare");
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ 生成中...";
    btn.style.pointerEvents = "none";

    try {
      const canvas = await html2canvas(node.querySelector(".share-inner"), {
        backgroundColor: "#0b0516",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: 750,
        windowWidth: 750,
      });
      sharedImageDataUrl = canvas.toDataURL("image/png");
      openSharePreview(sharedImageDataUrl);
    } catch (e) {
      console.error("Share generation failed:", e);
      alert("图片生成失败：" + (e.message || e));
    } finally {
      btn.innerHTML = originalText;
      btn.style.pointerEvents = "";
      node.style.left = "-10000px";
    }
  }

  function openSharePreview(dataUrl) {
    $("#sharePreviewImg").src = dataUrl;
    $("#sharePreview").classList.add("active");
    document.body.style.overflow = "hidden";
  }
  function closeSharePreview() {
    $("#sharePreview").classList.remove("active");
    document.body.style.overflow = "";
  }
  function downloadShareImage() {
    if (!sharedImageDataUrl) return;
    const hero = (lastResult && lastResult.hero) || {};
    const a = document.createElement("a");
    a.href = sharedImageDataUrl;
    a.download = `我是${hero.name || "英雄"}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  async function systemShare() {
    if (!sharedImageDataUrl) return;
    const hero = (lastResult && lastResult.hero) || {};
    try {
      const blob = await (await fetch(sharedImageDataUrl)).blob();
      const file = new File([blob], `我是${hero.name}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `我的人格是 ${hero.name}`,
          text: `我测出来是${hero.name}！来测测你是谁？`,
          files: [file],
        });
        return;
      }
    } catch (e) {}
    const url = location.origin + location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      alert("链接已复制！长按图片保存后一起分享给朋友");
    } catch (e) { alert("请长按图片保存后手动分享"); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
