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
  //  Particle background (archetype-aware)
  // ==========================================================
  // Global palette for particles, updated when archetype changes
  let PARTICLE_RGBS = [
    [232, 221, 192],  // paper/ink
    [201, 148, 26],   // gold
    [180, 35, 44],    // vermillion
  ];

  function setParticleRGBs(rgbList) {
    PARTICLE_RGBS = rgbList;
  }

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
        a: Math.random() * 0.6 + 0.2,
        rgbIdx: Math.floor(Math.random() * 3),
      });
    }

    function loop() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const rgb = PARTICLE_RGBS[p.rgbIdx % PARTICLE_RGBS.length];
        const huePrefix = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},`;

        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, huePrefix + p.a + ")");
        grad.addColorStop(1, huePrefix + "0)");
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = huePrefix + "0.9)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  // Parse "rgba(r,g,b," prefix string into [r,g,b]
  function parseRgbTriple(prefix) {
    const m = (prefix || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return null;
    return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)];
  }

  // Hex #RRGGBB → [r,g,b]
  function hexToRgb(hex) {
    if (!hex) return [180, 35, 44];
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  // Apply a hero's archetype theme to CSS vars + particle palette
  function applyTheme(hero) {
    const theme = hero && hero.theme;
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty("--theme-primary", theme.primary);
    root.style.setProperty("--theme-glow", theme.glow);
    root.style.setProperty("--theme-accent", theme.accent);
    const rgb = parseRgbTriple(theme.particle_hue);
    if (rgb) root.style.setProperty("--theme-particle-rgb", rgb.join(","));

    // update particle palette: mix archetype color + ink + gold
    const themeRgb = rgb || [180, 35, 44];
    setParticleRGBs([
      themeRgb,
      [232, 221, 192],   // 宣纸
      [201, 148, 26],    // 古金
    ]);
  }

  // Reset theme (intro/quiz pages)
  function resetTheme() {
    const root = document.documentElement;
    root.style.setProperty("--theme-primary", "#B4232C");
    root.style.setProperty("--theme-glow",    "#B4232C");
    root.style.setProperty("--theme-accent",  "#e8c76f");
    root.style.setProperty("--theme-particle-rgb", "184,35,44");
    setParticleRGBs([
      [232, 221, 192],
      [201, 148, 26],
      [180, 35, 44],
    ]);
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
      resetTheme();
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
      if (hero) {
        const uv = neutralUserVec();
        // fake ranked based on user vec so the "同行/反差" still shows something
        const ranked = HEROES.map(h => ({ hero: h, sim: cosineMatch(hero.vec, h.vec) }))
                              .sort((a, b) => b.sim - a.sim);
        renderResult(hero, uv, 0.7, ranked);
      }
    }
  }

  // ==========================================================
  //  Quiz flow
  // ==========================================================
  function startQuiz() {
    // v8: use ALL questions for repeatability (重测信度)
    // only shuffle order for varied experience
    QUESTIONS = randomSample(POOL, POOL.length);
    POOL_BIAS = computePoolBias();
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
    resetTheme();
    show("intro");
  }

  function finishQuiz() {
    show("loading");
    $("#progressFill").style.width = "100%";
    setTimeout(() => {
      const userVec = scoreUser(answers);
      const { hero, matchScore, ranked } = findBestHero(userVec);
      if (window.WzryAPI && WzryAPI.configured) WzryAPI.trackResult(hero.id, userVec);
      renderResult(hero, userVec, matchScore, ranked);
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

  // Compute the per-dim expected bias if user answered totally randomly.
  // Subtracting this from raw shifts the "neutral" anchor back to 5,
  // even if the question pool has residual secondary-dim imbalance.
  let POOL_BIAS = null;
  // Expected per-dim raw shift if user answered the SAMPLED questions purely at random.
  // Equals: for each question, mean weight on dim d across its 4 options, summed across all questions.
  function computePoolBias() {
    const bias = {};
    DIM_IDS.forEach(d => bias[d] = 0);
    for (const q of QUESTIONS) {
      for (const d of DIM_IDS) {
        let sum = 0;
        for (const opt of q.options) sum += (opt.w[d] || 0);
        bias[d] += sum / q.options.length;  // expected contribution per question
      }
    }
    return bias;
  }

  // User raw sum → scaled to 0-10 scale (centered at 5, bias-corrected)
  function scoreUser(ans) {
    const raw = {};
    DIM_IDS.forEach(d => raw[d] = 0);
    ans.forEach((optIdx, qi) => {
      const w = QUESTIONS[qi].options[optIdx].w || {};
      DIM_IDS.forEach(d => { if (w[d] != null) raw[d] += w[d]; });
    });
    if (!POOL_BIAS) POOL_BIAS = computePoolBias();
    const out = {};
    DIM_IDS.forEach(d => {
      // subtract expected bias so "totally random" user ends up at 5, not skewed
      const centered = raw[d] - POOL_BIAS[d];
      // scale: tuned so user std matches hero std (~2-3)
      // scale=2 → std ≈ sqrt(30)*1/2 ≈ 2.7 which matches hero distribution
      const v = 5 + centered / 2;
      out[d] = Math.max(0, Math.min(10, v));
    });
    return out;
  }

  // Cosine similarity on vectors centered at 5 (direction matters, not magnitude).
  // This gives much better hero coverage than Manhattan distance because the
  // user's "lean pattern" matches heroes with the same lean, regardless of how
  // extreme the user/hero happen to be.
  function cosineMatch(userVec, heroVec) {
    let dot = 0, nu = 0, nh = 0;
    for (const d of DIM_IDS) {
      const u = (userVec[d] || 5) - 5;
      const h = (heroVec[d] || 5) - 5;
      dot += u * h;
      nu  += u * u;
      nh  += h * h;
    }
    if (nu === 0 || nh === 0) return 0;
    return dot / (Math.sqrt(nu) * Math.sqrt(nh));
  }

  function findBestHero(userVec) {
    let best = null, bestSim = -Infinity;
    const ranked = [];
    for (const h of HEROES) {
      const sim = cosineMatch(userVec, h.vec);
      ranked.push({ hero: h, sim });
      if (sim > bestSim) { bestSim = sim; best = h; }
    }
    ranked.sort((a, b) => b.sim - a.sim);
    // map cosine [-1, 1] → match score [0, 1]
    const matchScore = (bestSim + 1) / 2;
    return { hero: best, matchScore, ranked };
  }

  // ==========================================================
  //  Result render
  // ==========================================================
  function renderResult(hero, userVec, matchScore, ranked) {
    lastResult = { hero, userVec, matchScore, ranked };
    show("result");

    // apply archetype theme (CSS vars + particles)
    applyTheme(hero);

    $("#resEra").textContent = hero.era || "英雄";
    $("#resArchetype").textContent = hero.archetype || "";
    $("#cardSig").textContent = (hero.theme && hero.theme.sig) || "英";
    $("#resName .name-char").textContent = hero.name;
    $("#matchName").textContent = hero.name;
    $("#resTitle").textContent = hero.title;
    $("#resRole").textContent = (hero.role || "") + (hero.era ? "  ·  " + hero.era : "");
    $("#resQuote").textContent = "「" + hero.quote + "」";
    $("#resMood").textContent = (hero.theme && hero.theme.mood) || "";
    $("#resLore").textContent = hero.lore;
    $("#resPersonality").textContent = hero.personality;
    $("#resWisdom").textContent = hero.wisdom || "";

    $("#matchValue").textContent = (matchScore * 100).toFixed(1) + " %";

    // ========= v7: 以"你"为主的人格画像 =========
    if (window.WzryContent) {
      // 人格代码
      $("#resCode").textContent = WzryContent.buildCode(userVec).split("").join("  ");
      // 类型名
      $("#resTypeName").textContent = WzryContent.buildTypeName(userVec);
      // 本质画像
      $("#resEssence").textContent = WzryContent.buildEssence(userVec);
      // 8 维深度解读
      renderDeepDims(userVec);
      // 5 生活场景
      renderScenarios(userVec);
      // 优势/盲点/驱动
      const swe = WzryContent.buildSWE(userVec);
      $("#resSWEStrength").textContent = swe.strength;
      $("#resSWEBlindspot").textContent = swe.blindspot;
      $("#resSWEEngine").textContent = swe.engine;
    }

    // 仍然保留的现有板块
    renderInscription(userVec);
    renderFateArchetype(userVec);
    renderSimilarity(userVec, hero);
    renderKindred(hero, ranked);

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
    if (matchList) {
      matchList.innerHTML = "";
      (hero.matches_you_if || []).forEach(m => {
        const li = document.createElement("li");
        li.textContent = m;
        matchList.appendChild(li);
      });
    }

    // 8 dimensions
    renderDims(userVec);

    try {
      const u = new URL(location.href);
      u.searchParams.set("r", hero.id);
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  // =========== 新增：人格铭文（最强3维合成3字短语） ===========
  // Lookup table for pole → display char (+ long label)
  const POLE_LABEL = {
    // {primary, long} per pole. Map from dim+side → {char, desc}
  };
  function dimPoleChar(dim, side) {
    // side: 'L' or 'R' — relative to dimension definition
    const dimDef = DIMS.find(d => d.id === dim);
    if (!dimDef) return { char: "?", long: "?" };
    const pole = side === "L" ? dimDef.left : dimDef.right;
    return { char: pole.name, long: pole.desc };
  }

  function renderInscription(userVec) {
    // take the 3 dimensions where user leans most strongly
    const leans = DIMS.map(dim => {
      const v = userVec[dim.id];
      const lean = v - 5;            // +ve = right pole, -ve = left pole
      const strength = Math.abs(lean);
      return { dim: dim.id, side: lean >= 0 ? "R" : "L", strength };
    }).sort((a, b) => b.strength - a.strength);

    const top3 = leans.slice(0, 3).map(l => dimPoleChar(l.dim, l.side).char);
    // If all three have very low strength, user is "中和" balanced
    if (leans[0].strength < 0.6) {
      $("#resInscription").textContent = "中 · 和 · 衡";
    } else {
      $("#resInscription").textContent = top3.join("  ·  ");
    }
  }

  // =========== 命运趋向：用户最接近哪个原型的中心 ===========
  function renderFateArchetype(userVec) {
    if (!HEROES.length) return;
    // group hero vectors by archetype
    const centroids = {};
    const counts = {};
    for (const h of HEROES) {
      const a = h.archetype || "谋士";
      if (!centroids[a]) centroids[a] = { F:0,G:0,W:0,Y:0,K:0,R:0,Z:0,M:0 };
      counts[a] = (counts[a] || 0) + 1;
      for (const d of DIM_IDS) centroids[a][d] += (h.vec[d] || 5);
    }
    for (const a in centroids) {
      for (const d of DIM_IDS) centroids[a][d] /= counts[a];
    }
    // find nearest centroid
    let bestA = null, bestSim = -Infinity;
    for (const a in centroids) {
      const sim = cosineMatch(userVec, centroids[a]);
      if (sim > bestSim) { bestSim = sim; bestA = a; }
    }
    const MOOD = {
      "武将": "征伐之魂 · 以力破局",
      "文人": "文墨之心 · 以笔言志",
      "帝王": "王道之途 · 以权立世",
      "谋士": "谋虑之智 · 以远取胜",
      "侠客": "江湖之义 · 以孤行远",
      "隐士": "逍遥之性 · 以退为进",
      "女将": "温刚之德 · 以柔克强",
    };
    $("#resFateArchetype").textContent = (MOOD[bestA] || bestA);
  }

  // =========== 同与不同 ===========
  function renderSimilarity(userVec, hero) {
    // compare each dim: compute |user - hero|, find 2 smallest (same) and 1 largest (diff)
    const diffs = DIMS.map(dim => {
      const d = dim.id;
      const delta = Math.abs(userVec[d] - hero.vec[d]);
      return { dim, delta };
    }).sort((a, b) => a.delta - b.delta);

    const same = diffs.slice(0, 2);
    const diff = diffs[diffs.length - 1];

    const wrap = $("#resSimilarity");
    wrap.innerHTML = "";

    same.forEach(s => {
      const dim = s.dim;
      const uLean = userVec[dim.id] >= 5 ? dim.right : dim.left;
      const hLean = hero.vec[dim.id] >= 5 ? dim.right : dim.left;
      // both leaning same side (since delta is small)
      const sideDesc = uLean.name;
      const row = document.createElement("div");
      row.className = "sim-row same";
      row.innerHTML = `<div class="sim-icon">✓</div>
        <div class="sim-text">在<span class="sim-dim">${dim.name}</span>这一维，你和 ${hero.name} 都偏 <strong>${sideDesc}</strong> · ${uLean.desc}</div>`;
      wrap.appendChild(row);
    });

    const d = diff.dim;
    const uName = userVec[d.id] >= 5 ? d.right.name : d.left.name;
    const hName = hero.vec[d.id]  >= 5 ? d.right.name : d.left.name;
    const row = document.createElement("div");
    row.className = "sim-row diff";
    if (uName === hName) {
      // both same side but magnitude differs — comparative
      const stronger = userVec[d.id] > hero.vec[d.id] ? "你" : hero.name;
      row.innerHTML = `<div class="sim-icon">⚡</div>
        <div class="sim-text">但在<span class="sim-dim">${d.name}</span>上 <strong>${stronger}更极端</strong>；你对 ${uName} 的程度和 ${hero.name} 不完全一样</div>`;
    } else {
      row.innerHTML = `<div class="sim-icon">⚡</div>
        <div class="sim-text">但在<span class="sim-dim">${d.name}</span>上你们相反——你更 <strong>${uName}</strong>，${hero.name} 更 <strong>${hName}</strong></div>`;
    }
    wrap.appendChild(row);
  }

  // =========== 警惕 / 发挥 ===========
  const WARN_SENTENCES = {
    "守": "过于稳重会错失良机——有时候快比稳更关键。",
    "锋": "锋芒太露容易树敌——学着收一收，刀在鞘里更威严。",
    "群": "太依赖集体容易失去判断——偶尔逆流会让你清醒。",
    "独": "过度独立会让真心伤你的人无从靠近——留条缝隙。",
    "直": "凭直觉冲过头，事后会收拾残局——关键决定多想一步。",
    "谋": "算得太多反而错过当下——有些事感觉比分析准。",
    "近": "只活在当下会让未来给你惊吓——留一点远见。",
    "远": "一直为未来活会让现在变成荒地——别忘了眼前的人。",
    "柔": "太灵活会让你失去自己的形状——要有不让步的事。",
    "钢": "太硬会断——弯一下不是输，是智慧。",
    "冷": "太克制会让爱你的人觉得冷——偶尔暖一下。",
    "热": "情绪太满会伤到自己——留一点余地。",
    "利": "只看结果会失去朋友——有些事值得亏一点。",
    "义": "原则太硬会困住自己——有些战场不值得死守。",
    "隐": "过度韬光会错过该你的时代——该出手就出手。",
    "明": "锋芒毕露会让人防着你——低调一点活得久。",
  };
  const STRENGTH_SENTENCES = {
    "守": "以守为攻是你天然的优势——别人冲上头时你能看清棋局。",
    "锋": "先声夺人的气势是你的武器——关键时敢出手能定局面。",
    "群": "团队润滑剂是你的位置——没有你，很多协作会散。",
    "独": "独立思考让你不随波逐流——这个时代特别缺这种人。",
    "直": "直觉敏锐是你的天赋——别人算来算去，你已经动了。",
    "谋": "运筹帷幄是你的长项——把别人的三步棋看得清清楚楚。",
    "近": "把当下做好就是你的本事——再远的事也是一步步走到的。",
    "远": "看得远是你的核心竞争力——别人看不到的机会你能预判。",
    "柔": "灵活柔软是你的武器——像水一样绕过障碍而不是撞碎。",
    "钢": "一诺千金是你的分量——这个世界缺少死不回头的人。",
    "冷": "在情绪洪流里保持冷静是你的优势——关键时你最可靠。",
    "热": "情感充沛能感染人——你在的地方气氛就暖。",
    "利": "务实取舍是智慧——不被虚名套牢，能走最实的路。",
    "义": "原则至上让你比多数人活得坦荡——这是精神上的底气。",
    "隐": "深藏不露是高手气质——等待时机的能力比什么都珍贵。",
    "明": "光明磊落是气场——做人透明，别人就愿意靠近你。",
  };

  function renderAdvice(userVec) {
    // find most extreme dim (warning) and second most extreme (strength)
    const leans = DIMS.map(dim => {
      const v = userVec[dim.id];
      const lean = v - 5;
      return { dim, side: lean >= 0 ? "R" : "L",
               poleName: (lean >= 0 ? dim.right : dim.left).name,
               strength: Math.abs(lean) };
    }).sort((a, b) => b.strength - a.strength);

    if (leans[0].strength < 0.5) {
      $("#resWarning").textContent = "你各维度都很均衡，这既是优势也是挑战——注意别因此显得没立场。";
      $("#resStrength").textContent = "平衡本身就是一种力量。你不走极端，因此遇到任何局面都不会崩。";
      return;
    }
    $("#resWarning").textContent  = WARN_SENTENCES[leans[0].poleName] || "—";
    $("#resStrength").textContent = STRENGTH_SENTENCES[leans[1].poleName] || "—";
  }

  // =========== 同行者 + 反差者 ===========
  function renderKindred(hero, ranked) {
    const wrap = $("#resKindred");
    wrap.innerHTML = "";
    if (!ranked || !ranked.length) return;

    // top 2 similar (excluding the matched hero)
    const similar = ranked.filter(x => x.hero.id !== hero.id).slice(0, 2);
    // most different (lowest sim)
    const opposite = ranked[ranked.length - 1];

    similar.forEach((m, i) => {
      const div = document.createElement("div");
      div.className = "kindred-item";
      const pct = ((m.sim + 1) / 2 * 100).toFixed(1);
      div.innerHTML = `<div class="kindred-tag">同行 TOP${i + 1}</div>
                       <div class="kindred-name">${m.hero.name}</div>
                       <div class="kindred-pct">契合 ${pct}%</div>`;
      wrap.appendChild(div);
    });
    if (opposite) {
      const div = document.createElement("div");
      div.className = "kindred-item diff";
      const pct = ((opposite.sim + 1) / 2 * 100).toFixed(1);
      div.innerHTML = `<div class="kindred-tag">反差</div>
                       <div class="kindred-name">${opposite.hero.name}</div>
                       <div class="kindred-pct">契合 ${pct}%</div>`;
      wrap.appendChild(div);
    }
  }

  // =========== v7: 8 维深度解读 + 历史人物举例 ===========
  function renderDeepDims(userVec) {
    if (!window.WzryContent) return;
    const wrap = $("#dimsDeepWrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    DIMS.forEach(dim => {
      const score = userVec[dim.id];
      const interp = WzryContent.buildDimInterpret(dim.id, score, HEROES);
      const sideName = score < 4 ? dim.left.name : (score > 6 ? dim.right.name : "中和");
      const pct = Math.max(0, Math.min(100, (score / 10) * 100));
      const row = document.createElement("div");
      row.className = "dim-deep-row";
      row.innerHTML = `
        <div class="dim-deep-head">
          <span class="dim-deep-name">${dim.name} · ${sideName}</span>
          <span class="dim-deep-axis">${dim.left.name} ↔ ${dim.right.name}　|　${score.toFixed(1)}</span>
        </div>
        <div class="dim-deep-bar"><div class="dim-deep-marker" style="left:${pct}%"></div></div>
        <div class="dim-deep-text">${interp.para}</div>
        <div class="dim-deep-similar">同维相近：<strong>${interp.similarHeroes.join(" · ")}</strong></div>
      `;
      wrap.appendChild(row);
    });
  }

  // =========== v7: 5 生活场景 ===========
  function renderScenarios(userVec) {
    if (!window.WzryContent) return;
    const wrap = $("#scenariosWrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    const scenarios = WzryContent.buildScenarios(userVec);
    Object.entries(scenarios).forEach(([name, text]) => {
      const row = document.createElement("div");
      row.className = "scenario-row";
      row.innerHTML = `
        <div class="scenario-icon">${name}</div>
        <div class="scenario-text">${text}</div>
      `;
      wrap.appendChild(row);
    });
  }

  function renderDims(userVec) {
    const wrap = $("#dimsWrap");
    if (!wrap) return;   // v7 removed the simpler bar display; new deep-dims is used instead
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


  // ==========================================================
  //  Share image
  // ==========================================================
  let sharedImageDataUrl = null;

  async function generateShareImage() {
    if (!lastResult) return;
    const { hero, userVec } = lastResult;

    $("#shareEra").textContent = hero.era || "";
    $("#shareArchetype").textContent = hero.archetype || "";
    $("#shareName").textContent = hero.name;
    $("#shareTitle").textContent = hero.title;
    $("#shareRole").textContent = (hero.era || "") + " · " + (hero.role || "");
    $("#shareQuote").textContent = "「" + hero.quote + "」";
    $("#shareMood").textContent = (hero.theme && hero.theme.mood) || "";
    $("#shareDesc").textContent = hero.personality;
    // Pre-compute share-card theme variants for html2canvas (no color-mix support).
    // Set --share-sig + --share-glow-NN + --share-primary-NN vars on .share-inner.
    const shareInner = $(".share-inner");
    if (shareInner && hero.theme) {
      shareInner.style.setProperty("--share-sig", `"${hero.theme.sig}"`);
      const glowRgb = hexToRgb(hero.theme.glow);
      const primaryRgb = hexToRgb(hero.theme.primary);
      [6, 12, 18, 25, 30, 35, 40, 45, 50].forEach(pct => {
        shareInner.style.setProperty(`--share-glow-${String(pct).padStart(2, "0")}`,
          `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, ${pct / 100})`);
        shareInner.style.setProperty(`--share-primary-${String(pct).padStart(2, "0")}`,
          `rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, ${pct / 100})`);
      });
      // also ensure --theme-glow / --theme-primary are set on the share root
      // (html2canvas evaluates against the element's computed style)
      shareInner.style.setProperty("--theme-glow", hero.theme.glow);
      shareInner.style.setProperty("--theme-primary", hero.theme.primary);
      shareInner.style.setProperty("--theme-accent", hero.theme.accent);
    }

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
