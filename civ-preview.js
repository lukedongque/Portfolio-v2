/* ═══════════════════════════════════════════════════════
   CIVILIZATION PREVIEW — Main Page Initializer
   -------------------------------------------------------
   Lightweight preview that renders the village inside
   the #civ-preview-canvas on index.html.
   
   Features:
   - Auto-panning camera (no user interaction)
   - 30fps to keep the main page lightweight
   - Lazy-loads on scroll (IntersectionObserver)
   - No sound, no drag-and-drop
   - Subtle day/night tint
═══════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const canvas = document.getElementById("civ-preview-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let initialized = false;
  let visitors = [];
  let agents = [];
  let world = {};
  let camera;
  let lastTime = 0;
  let animId;

  /** Resize canvas to fill container */
  function resize() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth * window.devicePixelRatio;
    canvas.height = container.clientHeight * window.devicePixelRatio;
    ctx.imageSmoothingEnabled = false;
    if (camera) {
      camera.canvasW = canvas.width;
      camera.canvasH = canvas.height;
    }
  }

  /** Update HUD elements */
  function updateHUD(population, eraInfo) {
    const popEl = document.getElementById("pop-count");
    const eraEl = document.getElementById("era-label");
    if (popEl) popEl.textContent = population;
    if (eraEl) eraEl.textContent = eraInfo.label;
  }

  /** Initialize everything */
  async function init() {
    if (initialized) return;
    initialized = true;

    resize();
    camera = CivEngine.Iso.createCamera(canvas.width, canvas.height);
    camera.autoPan = true;

    try {
      // register or retrieve this visitor
      const fp = await CivEngine.Fingerprint.generate();
      let existingVisitor = await CivEngine.DB.getVisitorByFingerprint(fp);

      if (!existingVisitor) {
        // count current population to determine role
        const allVisitors = await CivEngine.DB.getAllVisitors();
        const charData = CivEngine.CharGen.generate(fp, allVisitors.length + 1);
        existingVisitor = await CivEngine.DB.addVisitor(charData);
      }

      // load all visitors
      visitors = await CivEngine.DB.getAllVisitors();
    } catch (e) {
      console.warn("Supabase not configured, using demo mode:", e);
      // demo mode with fake visitors
      visitors = createDemoVisitors();
    }

    // build world
    world = CivEngine.Stages.generateWorld(visitors.length);

    // init AI agents (max 30 animated)
    const activeVisitors = visitors.slice(-30);
    agents = activeVisitors.map((v) => CivEngine.AI.initState(v, world));

    // update HUD
    const eraInfo = CivEngine.Stages.getEraInfo(visitors.length);
    updateHUD(visitors.length, eraInfo);

    // listen for new visitors in real-time
    try {
      CivEngine.DB.onNewVisitor((newVisitor) => {
        visitors.push(newVisitor);
        world = CivEngine.Stages.generateWorld(visitors.length);

        // add new agent if under cap
        if (agents.length < 30) {
          agents.push(CivEngine.AI.initState(newVisitor, world));
        }

        const eraInfo = CivEngine.Stages.getEraInfo(visitors.length);
        updateHUD(visitors.length, eraInfo);
      });
    } catch {}

    // start render loop
    lastTime = performance.now();
    animate();
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
    ];

    for (let i = 0; i < demoFingerprints.length; i++) {
      const char = CivEngine.CharGen.generate(demoFingerprints[i], i + 1);
      char.joined_at = new Date().toISOString();
      demos.push(char);
    }
    return demos;
  }

  /** Main animation loop — capped at ~30fps */
  function animate(now) {
    animId = requestAnimationFrame(animate);

    // throttle to ~30fps
    if (now - lastTime < 33) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // update camera
    CivEngine.Iso.updateCamera(camera);

    // update AI
    CivEngine.AI.updateAll(agents, world, dt);

    // render
    CivEngine.Renderer.renderFrame(ctx, canvas, world, visitors, agents, camera, {
      pixelScale: Math.max(1.5, canvas.width / 600),
      subtleDayNight: true,
    });
  }

  /** Lazy-load: only initialize when section scrolls into view */
  const section = document.getElementById("civilization");
  if (section) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            init();
            observer.unobserve(section);
          }
        });
      },
      { threshold: 0.1 },
    );
    observer.observe(section);
  }

  // handle resize
  window.addEventListener("resize", () => {
    if (initialized) resize();
  });
})();
