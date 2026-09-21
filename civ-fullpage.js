/* ═══════════════════════════════════════════════════════
   CIVILIZATION FULL PAGE — Immersive Experience
   -------------------------------------------------------
   Full-viewport experience on civilization.html with:
   - Pan/Zoom camera (drag + scroll wheel)
   - Drag-and-drop characters
   - Day/Night cycle (full intensity)
   - Ambient sound system
   - "Your Character" panel
   - Real-time HUD updates
═══════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const canvas = document.getElementById("civ-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let visitors = [];
  let agents = [];
  let world = {};
  let camera;
  let myFingerprint = null;
  let myVisitor = null;
  let lastTime = 0;

  // drag-and-drop state
  let dragAgent = null;
  let isDragging = false;
  let panStartX = 0, panStartY = 0;
  let isPanning = false;

  /* ── Canvas sizing ── */
  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.imageSmoothingEnabled = false;
    if (camera) {
      camera.canvasW = canvas.width;
      camera.canvasH = canvas.height;
    }
  }

  /* ── HUD Updates ── */
  function updateHUD(population, eraInfo, timeInfo) {
    const popEl = document.getElementById("full-pop-count");
    const eraEl = document.getElementById("full-era-label");
    const progressEl = document.querySelector(".era-progress__fill");
    const timeEl = document.getElementById("time-indicator");

    if (popEl) popEl.textContent = population;
    if (eraEl) eraEl.textContent = eraInfo.label;
    if (progressEl) progressEl.style.width = (eraInfo.progress * 100) + "%";
    if (timeEl) timeEl.textContent = timeInfo.emoji + " " + timeInfo.timeStr;
  }

  function updateCharPanel(visitor) {
    if (!visitor) return;
    const nameEl = document.getElementById("char-name");
    const roleEl = document.getElementById("char-role");
    const joinedEl = document.getElementById("char-joined");
    const portraitCanvas = document.getElementById("char-portrait");

    if (nameEl) nameEl.textContent = visitor.name;
    if (roleEl) roleEl.textContent = visitor.role;
    if (joinedEl) {
      const d = new Date(visitor.joined_at);
      joinedEl.textContent = "Joined " + d.toLocaleDateString();
    }
    if (portraitCanvas) {
      CivEngine.PixelArt.drawPortrait(portraitCanvas, visitor);
    }
  }

  /* ── Initialize ── */
  async function init() {
    resize();
    camera = CivEngine.Iso.createCamera(canvas.width, canvas.height);

    try {
      // register / retrieve this visitor
      myFingerprint = await CivEngine.Fingerprint.generate();
      myVisitor = await CivEngine.DB.getVisitorByFingerprint(myFingerprint);

      if (!myVisitor) {
        const allVisitors = await CivEngine.DB.getAllVisitors();
        const charData = CivEngine.CharGen.generate(myFingerprint, allVisitors.length + 1);
        myVisitor = await CivEngine.DB.addVisitor(charData);
      }

      visitors = await CivEngine.DB.getAllVisitors();
    } catch (e) {
      console.warn("Supabase not configured, using demo mode:", e);
      visitors = createDemoVisitors();
      myVisitor = visitors[0];
      myFingerprint = myVisitor.fingerprint;
    }

    // build world
    world = CivEngine.Stages.generateWorld(visitors.length);

    // init AI agents (max 30 animated)
    const activeVisitors = visitors.slice(-30);
    agents = activeVisitors.map((v) => CivEngine.AI.initState(v, world));

    // show character panel
    updateCharPanel(myVisitor);

    // listen for new visitors
    try {
      CivEngine.DB.onNewVisitor((newVisitor) => {
        visitors.push(newVisitor);
        world = CivEngine.Stages.generateWorld(visitors.length);
        if (agents.length < 30) {
          agents.push(CivEngine.AI.initState(newVisitor, world));
        }
      });
    } catch {}

    // first-visit tooltip
    if (!localStorage.getItem("civ_visited")) {
      const tooltip = document.getElementById("first-visit-tooltip");
      if (tooltip) {
        tooltip.classList.add("visible");
        localStorage.setItem("civ_visited", "1");
        setTimeout(() => tooltip.classList.remove("visible"), 5000);
      }
    }

    // start sound system
    CivEngine.Sound.init();

    // start render loop
    lastTime = performance.now();
    requestAnimationFrame(animate);
  }

  /** Create demo visitors for when Supabase is not configured */
  function createDemoVisitors() {
    const demos = [];
    const demoFingerprints = [
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
      "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
      "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
      "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
      "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
      "a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
      "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
    ];

    for (let i = 0; i < demoFingerprints.length; i++) {
      const char = CivEngine.CharGen.generate(demoFingerprints[i], i + 1);
      char.joined_at = new Date().toISOString();
      demos.push(char);
    }
    return demos;
  }

  /* ── Animation Loop — 60fps ── */
  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // update camera
    CivEngine.Iso.updateCamera(camera);

    // update AI
    CivEngine.AI.updateAll(agents, world, dt);

    // render
    const timeInfo = CivEngine.Renderer.renderFrame(ctx, canvas, world, visitors, agents, camera, {
      pixelScale: Math.max(2, canvas.width / 500),
      subtleDayNight: false,
    });

    // update HUD periodically (every ~30 frames)
    if (Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) {
      const eraInfo = CivEngine.Stages.getEraInfo(visitors.length);
      updateHUD(visitors.length, eraInfo, timeInfo);

      // update sound ambience based on time
      const era = CivEngine.Stages.getEraForPopulation(visitors.length);
      CivEngine.Sound.startAmbience(era, timeInfo.phase);
    }
  }

  /* ── Mouse / Touch Input ── */

  /** Find the agent under a screen position */
  function findAgentAt(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = (screenX - rect.left) * window.devicePixelRatio;
    const canvasY = (screenY - rect.top) * window.devicePixelRatio;
    const pixelScale = Math.max(2, canvas.width / 500);

    // check each agent (reverse order = top-most first)
    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i];
      const pos = CivEngine.Iso.gridToScreen(a.gx, a.gy, camera);
      const charW = 16 * pixelScale;
      const charH = 16 * pixelScale;
      const cx = pos.x - 8 * pixelScale;
      const cy = pos.y - 10 * pixelScale;

      if (
        canvasX >= cx && canvasX <= cx + charW &&
        canvasY >= cy && canvasY <= cy + charH
      ) {
        return a;
      }
    }
    return null;
  }

  // ── Mouse events ──
  canvas.addEventListener("mousedown", (e) => {
    const agent = findAgentAt(e.clientX, e.clientY);
    if (agent) {
      dragAgent = agent;
      dragAgent.isDragged = true;
      isDragging = true;
      document.body.classList.add("dragging");
    } else {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isDragging && dragAgent) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * window.devicePixelRatio;
      const canvasY = (e.clientY - rect.top) * window.devicePixelRatio;
      const gridPos = CivEngine.Iso.screenToGrid(canvasX, canvasY, camera);
      dragAgent.gx = gridPos.x;
      dragAgent.gy = gridPos.y;
    } else if (isPanning) {
      const dx = (e.clientX - panStartX) * window.devicePixelRatio;
      const dy = (e.clientY - panStartY) * window.devicePixelRatio;
      camera.targetX -= dx;
      camera.targetY -= dy;
      panStartX = e.clientX;
      panStartY = e.clientY;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDragging && dragAgent) {
      dragAgent.isDragged = false;
      // persist position to Supabase
      try {
        CivEngine.DB.updatePosition(dragAgent.fingerprint, dragAgent.gx, dragAgent.gy);
      } catch {}
      dragAgent = null;
      isDragging = false;
      document.body.classList.remove("dragging");
    }
    isPanning = false;
  });

  // ── Zoom ──
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 30 : -30;
    camera.targetX += zoomDelta;
    camera.targetY += zoomDelta * 0.5;
  }, { passive: false });

  // ── Touch events ──
  let touchStartX = 0, touchStartY = 0;

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const agent = findAgentAt(touch.clientX, touch.clientY);
      if (agent) {
        dragAgent = agent;
        dragAgent.isDragged = true;
        isDragging = true;
      } else {
        isPanning = true;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isDragging && dragAgent) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = (touch.clientX - rect.left) * window.devicePixelRatio;
        const canvasY = (touch.clientY - rect.top) * window.devicePixelRatio;
        const gridPos = CivEngine.Iso.screenToGrid(canvasX, canvasY, camera);
        dragAgent.gx = gridPos.x;
        dragAgent.gy = gridPos.y;
      } else if (isPanning) {
        const dx = (touch.clientX - touchStartX) * window.devicePixelRatio;
        const dy = (touch.clientY - touchStartY) * window.devicePixelRatio;
        camera.targetX -= dx;
        camera.targetY -= dy;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchend", () => {
    if (isDragging && dragAgent) {
      dragAgent.isDragged = false;
      try {
        CivEngine.DB.updatePosition(dragAgent.fingerprint, dragAgent.gx, dragAgent.gy);
      } catch {}
      dragAgent = null;
      isDragging = false;
    }
    isPanning = false;
  });

  // ── Sound toggle ──
  const soundBtn = document.getElementById("sound-toggle");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      const muted = CivEngine.Sound.toggleMute();
      soundBtn.textContent = muted ? "🔇 Sound" : "🔊 Sound";
    });
  }

  // ── Resize handler ──
  window.addEventListener("resize", resize);

  // ── Start ──
  init();
})();
