/* ── Scroll Spy ── */
const navLinks = document.querySelectorAll(".nav__link");
const sections = document.querySelectorAll("section[id]");
console.log(sections);
const onScroll = () => {
  const scrollY = window.scrollY;
  console.log(scrollY);
  sections.forEach((section) => {
    const top = section.offsetTop - 120;
    const bottom = top + section.offsetHeight;
    const id = section.getAttribute("id");
    const link = document.querySelector(`.nav__link[href="#${id}"]`);
    if (link) {
      if (id === "hero") {
        navLinks.forEach((l) => l.classList.remove("active"));
      } else {
        if (scrollY >= top && scrollY < bottom) {
          navLinks.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
      }
    }
  });
};

window.addEventListener("scroll", onScroll, { passive: true });

/* ── Mobile hamburger ── */
const hamburger = document.querySelector(".nav__hamburger");
const navMenu = document.querySelector(".nav__links");

hamburger.addEventListener("click", () => {
  navMenu.classList.toggle("open");
});

// close menu when a nav link is clicked
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("open");
  });
});

/* ── Scroll reveal ── */
const revealEls = document.querySelectorAll(
  ".about__grid, .skills__group, .projects__header, .projects__carousel-wrapper, .civilization__preview, .contact__inner",
);

revealEls.forEach((el) => el.classList.add("reveal"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

revealEls.forEach((el) => revealObserver.observe(el));

const profileImage = document.getElementById("profileImage");
const defaultSrc = "assets/profile_eyesopen.jpg";
const hoverSrc = "assets/profile_eyesclosed.jpg";

profileImage.addEventListener("mouseenter", () => {
  profileImage.src = hoverSrc;
});

profileImage.addEventListener("mouseleave", () => {
  profileImage.src = defaultSrc;
});

/* ═══════════════════════════════════════════════════════
   HERO LETTER ASSEMBLY ANIMATION
   Letters come flying in from outside the window/viewport
   and 3D space to assemble the text as the page loads.
═══════════════════════════════════════════════════════ */
(() => {
  const heroInner = document.querySelector(".hero__inner");
  if (!heroInner) return;

  const textTargets = [
    {
      selector: ".hero__label",
      delay: 80,
      stagger: 24,
      lockGlow: false,
    },
    {
      selector: ".hero__name",
      delay: 220,
      stagger: 32,
      lockGlow: true,
    },
    {
      selector: ".hero__tagline-text",
      delay: 640,
      stagger: 14,
      lockGlow: false,
    },
    {
      selector: ".hero__sub",
      delay: 1040,
      stagger: 9,
      lockGlow: false,
    },
  ];

  const ctaEl = document.querySelector(".hero__cta");
  const replayBtn = document.getElementById("hero-replay-btn");
  const nameEl = document.querySelector(".hero__name");

  let allCharacterEntries = [];
  let isAnimating = false;

  function getRandomOutsideOffset(el) {
    const vw = Math.max(
      window.innerWidth,
      document.documentElement.clientWidth,
      900,
    );
    const vh = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight,
      700,
    );

    const rect = el
      ? el.getBoundingClientRect()
      : { left: vw / 2, top: vh / 2, width: 20, height: 20 };

    // Choose which direction outside the window (0: Top, 1: Right, 2: Bottom, 3: Left, 4: Deep Periphery)
    const edge = Math.floor(Math.random() * 5);
    let x = 0;
    let y = 0;

    switch (edge) {
      case 0: // Above the top edge of the window
        y = -(rect.top + 100 + Math.random() * 250);
        x = (Math.random() - 0.5) * vw * 0.9;
        break;
      case 1: // Beyond the right edge of the window
        x = vw - rect.left + 100 + Math.random() * 250;
        y = (Math.random() - 0.5) * vh * 0.9;
        break;
      case 2: // Below the bottom edge of the window
        y = vh - rect.top + 100 + Math.random() * 250;
        x = (Math.random() - 0.5) * vw * 0.9;
        break;
      case 3: // Beyond the left edge of the window
        x = -(rect.left + 100 + Math.random() * 250);
        y = (Math.random() - 0.5) * vh * 0.9;
        break;
      case 4: // Deep radial periphery
      default: {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.max(vw, vh) * (0.8 + Math.random() * 0.5);
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
        break;
      }
    }

    // 3D perspective depth: letters burst in from depth
    const z = (Math.random() - 0.4) * 1200;
    const rotX = (Math.random() - 0.5) * 260;
    const rotY = (Math.random() - 0.5) * 260;
    const rotZ = (Math.random() - 0.5) * 200;
    const scale = 0.4 + Math.random() * 1.2;

    return { x, y, z, rotX, rotY, rotZ, scale };
  }

  function splitIntoSpans(container) {
    if (!container) return [];

    if (!container.dataset.originalText) {
      container.dataset.originalText = container.textContent.trim();
    }
    const text = container.dataset.originalText;
    const words = text.split(/\s+/);

    container.innerHTML = "";
    container.setAttribute("aria-hidden", "true");

    const charSpans = [];

    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement("span");
      wordSpan.className = "hero-word";

      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const charSpan = document.createElement("span");
        charSpan.className = "hero-char";
        charSpan.textContent = char;
        wordSpan.appendChild(charSpan);
        charSpans.push(charSpan);
      }

      container.appendChild(wordSpan);

      if (wordIndex < words.length - 1) {
        container.appendChild(document.createTextNode(" "));
      }
    });

    return charSpans;
  }

  function setupAnimation() {
    allCharacterEntries = [];

    textTargets.forEach((target) => {
      const el = document.querySelector(target.selector);
      if (!el) return;

      const charSpans = splitIntoSpans(el);
      allCharacterEntries.push({
        ...target,
        el,
        chars: charSpans,
      });
    });
  }

  function scatterAndAssemble() {
    if (isAnimating) return;
    isAnimating = true;

    // Check reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      allCharacterEntries.forEach((entry) => {
        entry.chars.forEach((charEl) => {
          charEl.removeAttribute("style");
          charEl.classList.add("is-formed");
        });
      });
      if (ctaEl) ctaEl.classList.remove("is-hidden");
      isAnimating = false;
      return;
    }

    if (ctaEl) ctaEl.classList.add("is-hidden");

    // Phase 1: Position each character outside the window
    allCharacterEntries.forEach((entry) => {
      entry.chars.forEach((charEl) => {
        const off = getRandomOutsideOffset(charEl);
        charEl.classList.remove("is-formed", "is-locked");
        charEl.style.transition = "none";
        charEl.style.transform = `translate3d(${off.x}px, ${off.y}px, ${off.z}px) rotateX(${off.rotX}deg) rotateY(${off.rotY}deg) rotateZ(${off.rotZ}deg) scale(${off.scale})`;
        charEl.style.opacity = "0.75";
        charEl.style.filter = "blur(3px)";
      });
    });

    // Force reflow
    void heroInner.offsetHeight;

    let latestEndTime = 0;

    // Phase 2: Animate letters into their coordinate positions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        allCharacterEntries.forEach((entry) => {
          entry.chars.forEach((charEl, charIdx) => {
            const flyDelay = entry.delay + charIdx * entry.stagger;
            const finishTime = flyDelay + 850;
            if (finishTime > latestEndTime) latestEndTime = finishTime;

            setTimeout(() => {
              charEl.style.transition =
                "transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease-out, filter 0.6s ease-out";
              charEl.style.transform =
                "translate3d(0px, 0px, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)";
              charEl.style.opacity = "1";
              charEl.style.filter = "none";
              charEl.classList.add("is-formed");

              if (entry.lockGlow) {
                setTimeout(() => {
                  charEl.classList.add("is-locked");
                }, 450);
              }
            }, flyDelay);
          });
        });

        // Phase 3: Fade CTA buttons back in
        setTimeout(
          () => {
            if (ctaEl) ctaEl.classList.remove("is-hidden");
          },
          Math.max(latestEndTime - 300, 1100),
        );

        // Unlock replay
        setTimeout(() => {
          isAnimating = false;
        }, latestEndTime + 200);
      });
    });
  }

  // Setup elements and start animation
  setupAnimation();
  setTimeout(scatterAndAssemble, 60);

  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      scatterAndAssemble();
    });
  }

  if (nameEl) {
    nameEl.addEventListener("click", () => {
      scatterAndAssemble();
    });
  }
})();

/* ── Contact form (FormSubmit AJAX) ── */
const form = document.querySelector(".contact__form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Sending...";
    btn.disabled = true;

    try {
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      if (response.ok) {
        btn.textContent = "Message sent ✓";
        btn.style.opacity = "0.7";
        form.reset();

        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
          btn.style.opacity = "1";
        }, 4000);
      } else {
        throw new Error("Form submission failed");
      }
    } catch (err) {
      console.error(err);
      btn.textContent = "Failed to send ✕";
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = originalText;
      }, 3000);
    }
  });
}

/* ═══════════════════════════════════════════════════════
   PARTICLE GRID BACKGROUND
═══════════════════════════════════════════════════════ */
(() => {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CONFIG = {
    particleCount: 80,
    maxSpeed: 0.3,
    particleRadius: 1.5,
    connectionDistance: 140,
    mouseRadius: 120,
    mouseForce: 0.02,
    particleColor: "rgba(255, 255, 255, 0.4)",
    lineColor: (alpha) => `rgba(255, 255, 255, ${alpha})`,
  };

  let width, height;
  const mouse = { x: -1000, y: -1000 };
  const particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * CONFIG.maxSpeed * 2;
      this.vy = (Math.random() - 0.5) * CONFIG.maxSpeed * 2;
      this.radius = CONFIG.particleRadius * (0.5 + Math.random() * 0.5);
    }

    update() {
      // mouse interaction — gentle push
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.mouseRadius && dist > 0) {
        const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius;
        this.vx += (dx / dist) * force * CONFIG.mouseForce;
        this.vy += (dy / dist) * force * CONFIG.mouseForce;
      }

      // clamp speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > CONFIG.maxSpeed) {
        this.vx = (this.vx / speed) * CONFIG.maxSpeed;
        this.vy = (this.vy / speed) * CONFIG.maxSpeed;
      }

      this.x += this.vx;
      this.y += this.vy;

      // wrap around edges
      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.particleColor;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles.length = 0;
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.connectionDistance) {
          const alpha = (1 - dist / CONFIG.connectionDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = CONFIG.lineColor(alpha);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.update();
      p.draw();
    });

    drawConnections();
    requestAnimationFrame(animate);
  }

  // events
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  init();
  animate();
})();

/* ═══════════════════════════════════════════════════════
   MAGNETIC DOT CURSOR WITH TRAIL
═══════════════════════════════════════════════════════ */
(() => {
  // skip on touch devices
  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(hover: none)").matches;
  if (isTouch) return;

  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (!dot || !ring) return;

  let mouseX = -100,
    mouseY = -100;
  let ringX = -100,
    ringY = -100;
  const ease = 0.15; // trailing ease factor (lower = more lag)

  // track mouse position
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // dot follows instantly
    dot.style.left = mouseX + "px";
    dot.style.top = mouseY + "px";
  });

  // ring follows with smooth ease
  function animateRing() {
    ringX += (mouseX - ringX) * ease;
    ringY += (mouseY - ringY) * ease;
    ring.style.left = ringX + "px";
    ring.style.top = ringY + "px";
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // interactive elements — expand ring on hover
  const interactiveSelectors =
    "a, button, .btn, .skill-badge, .project-card, .carousel-btn, .nav__hamburger, input, textarea, .typing-test-badge";

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(interactiveSelectors)) {
      dot.classList.add("is-hover");
      ring.classList.add("is-hover");
    }
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(interactiveSelectors)) {
      dot.classList.remove("is-hover");
      ring.classList.remove("is-hover");
    }
  });

  // hide cursor when mouse leaves the window
  document.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  });
})();

/* ═══════════════════════════════════════════════════════
   DYNAMIC ANIMATED PROJECT CAROUSEL (Left to Right)
═══════════════════════════════════════════════════════ */
function initProjectCarousel() {
  const viewport = document.getElementById("projectsCarouselViewport");
  const track = document.getElementById("projectsCarouselTrack");
  if (!viewport || !track) return;

  const prevBtn = document.querySelector(".carousel-btn--prev");
  const nextBtn = document.querySelector(".carousel-btn--next");
  const toggleBtn = document.querySelector(".carousel-btn--toggle");
  const statusEl = document.querySelector(".carousel-status");
  const statusText = document.querySelector(".carousel-status__text");

  const originalCards = Array.from(track.children);
  if (originalCards.length === 0) return;

  // Clone cards to ensure gapless infinite looping across all screen sizes
  const CLONE_SETS = 3;
  for (let s = 0; s < CLONE_SETS; s++) {
    originalCards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.dataset.clone = "true";
      // Prevent keyboard tabbing to duplicates
      clone.querySelectorAll("a, button").forEach((el) => {
        el.setAttribute("tabindex", "-1");
      });
      track.appendChild(clone);
    });
  }

  let singleSetWidth = 0;
  function measureSetWidth() {
    const firstCard = originalCards[0];
    const firstClone = track.children[originalCards.length];
    if (firstCard && firstClone) {
      singleSetWidth = firstClone.offsetLeft - firstCard.offsetLeft;
    }
    if (!singleSetWidth || singleSetWidth <= 0) {
      const cardRect = firstCard ? firstCard.getBoundingClientRect() : { width: 380 };
      singleSetWidth = (cardRect.width + 28) * originalCards.length;
    }
  }

  measureSetWidth();
  window.addEventListener("resize", measureSetWidth);
  window.addEventListener("load", measureSetWidth);

  // Motion preferences & state
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let isPaused = prefersReducedMotion;
  let isHovered = false;
  let isDragging = false;

  // Left to right movement: positive speed moves track to the right
  const baseSpeed = 0.85;
  let currentSpeed = isPaused ? 0 : baseSpeed;
  let targetSpeed = isPaused ? 0 : baseSpeed;
  let impulseVelocity = 0;

  // Start positioned inside the cloned set
  let posX = -singleSetWidth;
  track.style.transform = `translate3d(${posX}px, 0, 0)`;

  function updateStatusUI() {
    if (!statusEl || !statusText || !toggleBtn) return;
    if (isPaused) {
      statusEl.classList.add("is-paused");
      statusText.textContent = "CAROUSEL PAUSED";
      toggleBtn.textContent = "PLAY";
      toggleBtn.setAttribute("title", "Resume carousel motion");
    } else {
      statusEl.classList.remove("is-paused");
      statusText.textContent = isHovered ? "HOVER PAUSED" : "LIVE CAROUSEL";
      toggleBtn.textContent = "PAUSE";
      toggleBtn.setAttribute("title", "Pause carousel motion");
    }
  }

  if (isPaused) {
    updateStatusUI();
  }

  // Animation Loop (requestAnimationFrame)
  function animate() {
    if (isPaused || isHovered || isDragging) {
      targetSpeed = 0;
    } else {
      targetSpeed = baseSpeed;
    }

    // Smooth speed easing
    currentSpeed += (targetSpeed - currentSpeed) * 0.08;

    // Movement: left-to-right drift + any impulse from buttons or drag release
    if (!isDragging) {
      posX += currentSpeed + impulseVelocity;
      impulseVelocity *= 0.88;
      if (Math.abs(impulseVelocity) < 0.01) impulseVelocity = 0;
    }

    // Seamless loop wrapping
    if (singleSetWidth > 0) {
      while (posX >= 0) {
        posX -= singleSetWidth;
      }
      while (posX < -singleSetWidth * 2) {
        posX += singleSetWidth;
      }
    }

    track.style.transform = `translate3d(${posX}px, 0, 0)`;
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // Hover detection: pause on mouse enter, resume on mouse leave
  viewport.addEventListener("mouseenter", () => {
    isHovered = true;
    updateStatusUI();
  });

  viewport.addEventListener("mouseleave", () => {
    isHovered = false;
    updateStatusUI();
  });

  // Toggle Play / Pause Button
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isPaused = !isPaused;
      updateStatusUI();
    });
  }

  // Prev / Next Step Buttons
  function getStepDistance() {
    const card = originalCards[0];
    if (card) {
      const rect = card.getBoundingClientRect();
      return rect.width + 28;
    }
    return 380;
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      // Step towards left
      impulseVelocity -= getStepDistance() * 0.12;
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      // Step towards right
      impulseVelocity += getStepDistance() * 0.12;
    });
  }

  // Pointer Drag & Swipe Handling
  let startX = 0;
  let lastX = 0;
  let dragDistance = 0;
  let dragVelocity = 0;
  let lastTime = 0;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Don't intercept pointer or start dragging if user clicks a link or button
    if (e.target.closest("a, button")) {
      dragDistance = 0;
      return;
    }

    isDragging = true;
    startX = e.clientX;
    lastX = e.clientX;
    dragDistance = 0;
    dragVelocity = 0;
    lastTime = performance.now();
    viewport.classList.add("is-dragging");

    if (viewport.setPointerCapture) {
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!isDragging) return;

    const currentX = e.clientX;
    const dx = currentX - lastX;
    dragDistance += Math.abs(dx);

    const now = performance.now();
    const dt = Math.max(now - lastTime, 1);
    dragVelocity = (dx / dt) * 16;

    lastX = currentX;
    lastTime = now;

    posX += dx;

    // Seamless loop wrap during drag
    if (singleSetWidth > 0) {
      while (posX >= 0) {
        posX -= singleSetWidth;
      }
      while (posX < -singleSetWidth * 2) {
        posX += singleSetWidth;
      }
    }
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove("is-dragging");

    if (viewport.releasePointerCapture && e.pointerId !== undefined) {
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    // Apply inertia toss
    impulseVelocity = Math.max(Math.min(dragVelocity, 25), -25);

    // Reset dragDistance after pending click event cycle completes
    setTimeout(() => {
      dragDistance = 0;
    }, 50);
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  // Prevent link navigation if dragging occurred
  track.addEventListener(
    "click",
    (e) => {
      if (dragDistance > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initProjectCarousel();
    initAmbientMusic();
  });
} else {
  initProjectCarousel();
  initAmbientMusic();
}

/* ═══════════════════════════════════════════════════════
   AMBIENT BACKGROUND MUSIC CONTROLLER (SiriusS19YT)
═══════════════════════════════════════════════════════ */
function initAmbientMusic() {
  const toggleBtn = document.getElementById("bgm-toggle");
  if (!toggleBtn) return;

  const labelEl = toggleBtn.querySelector(".bgm-label");
  const audioSrc = "assets/music/ambient-synth-loop.ogg";
  const TARGET_VOLUME = 0.22; // subtle, comfortable background volume
  const FADE_TIME_MS = 800;

  let audio = null;
  let isPlaying = false;
  let fadeInterval = null;
  let wasPlayingBeforeHidden = false;

  function getOrCreateAudio() {
    if (!audio) {
      audio = document.createElement("audio");
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;

      // Add sources: MP3 first if added (for iOS Safari), then OGG
      const sourceMp3 = document.createElement("source");
      sourceMp3.src = "assets/music/ambient-synth-loop.mp3";
      sourceMp3.type = "audio/mpeg";

      const sourceOgg = document.createElement("source");
      sourceOgg.src = "assets/music/ambient-synth-loop.ogg";
      sourceOgg.type = "audio/ogg";

      audio.appendChild(sourceMp3);
      audio.appendChild(sourceOgg);
    }
    return audio;
  }

  function fadeTo(targetVol, durationMs, onComplete) {
    if (!audio) return;
    if (fadeInterval) clearInterval(fadeInterval);

    const stepMs = 40;
    const steps = Math.max(1, durationMs / stepMs);
    const startVol = audio.volume;
    const delta = (targetVol - startVol) / steps;

    fadeInterval = setInterval(() => {
      let nextVol = audio.volume + delta;
      if (
        (delta > 0 && nextVol >= targetVol) ||
        (delta < 0 && nextVol <= targetVol) ||
        isNaN(nextVol)
      ) {
        audio.volume = Math.max(0, Math.min(1, targetVol));
        clearInterval(fadeInterval);
        fadeInterval = null;
        if (onComplete) onComplete();
      } else {
        audio.volume = Math.max(0, Math.min(1, nextVol));
      }
    }, stepMs);
  }

  function playMusic() {
    const sound = getOrCreateAudio();
    sound
      .play()
      .then(() => {
        isPlaying = true;
        updateUI(true);
        fadeTo(TARGET_VOLUME, FADE_TIME_MS);
        try {
          localStorage.setItem("portfolio_bgm_state", "playing");
        } catch (err) {}
      })
      .catch((err) => {
        // Browser blocked audio autoplay before user interaction:
        // Keep UI in ON state and ensure first real user gesture begins playback
        isPlaying = false;
        setupAutoResumeOnFirstGesture();
      });
  }

  function pauseMusic() {
    if (!audio) return;
    isPlaying = false;
    updateUI(false);
    fadeTo(0, 500, () => {
      if (!isPlaying && audio) {
        audio.pause();
      }
    });
    try {
      localStorage.setItem("portfolio_bgm_state", "paused");
    } catch (err) {}
  }

  function updateUI(playing) {
    if (playing) {
      toggleBtn.classList.add("is-playing");
      toggleBtn.setAttribute("aria-label", "Mute ambient music");
      if (labelEl) labelEl.textContent = "BGM: ON";
    } else {
      toggleBtn.classList.remove("is-playing");
      toggleBtn.setAttribute("aria-label", "Play ambient music");
      if (labelEl) labelEl.textContent = "BGM: OFF";
    }
  }

  toggleBtn.addEventListener("click", () => {
    if (isPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  });

  // Handle visibility changes (pause when tab hidden, resume when tab visible)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (isPlaying && audio) {
        wasPlayingBeforeHidden = true;
        audio.pause();
      }
    } else {
      if (wasPlayingBeforeHidden && audio) {
        wasPlayingBeforeHidden = false;
        audio.play().catch(() => {});
      }
    }
  });

  let hasAttachedGestureListeners = false;
  function setupAutoResumeOnFirstGesture() {
    if (hasAttachedGestureListeners) return;
    hasAttachedGestureListeners = true;

    const onUserInteraction = () => {
      let state = "playing";
      try {
        state = localStorage.getItem("portfolio_bgm_state") || "playing";
      } catch (e) {}

      if (state !== "paused") {
        const sound = getOrCreateAudio();
        sound
          .play()
          .then(() => {
            isPlaying = true;
            updateUI(true);
            fadeTo(TARGET_VOLUME, FADE_TIME_MS);
            cleanupGestureListeners();
          })
          .catch((err) => {
            // Still waiting for a valid user gesture
            console.warn("Waiting for user gesture to start audio:", err);
          });
      }
    };

    function cleanupGestureListeners() {
      hasAttachedGestureListeners = false;
      document.removeEventListener("pointerdown", onUserInteraction);
      document.removeEventListener("click", onUserInteraction);
      document.removeEventListener("touchstart", onUserInteraction);
      document.removeEventListener("keydown", onUserInteraction);
    }

    // Only genuine user activation events that modern browsers accept
    document.addEventListener("pointerdown", onUserInteraction, { passive: true });
    document.addEventListener("click", onUserInteraction, { passive: true });
    document.addEventListener("touchstart", onUserInteraction, { passive: true });
    document.addEventListener("keydown", onUserInteraction, { passive: true });
  }

  // Default to ON unless user explicitly paused in a previous session
  let savedState = null;
  try {
    savedState = localStorage.getItem("portfolio_bgm_state");
  } catch (err) {}

  if (savedState === "paused") {
    // User explicitly paused in a previous session
    isPlaying = false;
    updateUI(false);
  } else {
    // Default to ON!
    updateUI(true);
    playMusic();
  }
}

