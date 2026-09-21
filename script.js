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
  ".about__grid, .skills__group, .project-card, .civilization__preview, .contact__inner",
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
    "a, button, .btn, .skill-badge, .project-card, .nav__hamburger, input, textarea, .typing-test-badge";

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
