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
      if (scrollY >= top && scrollY < bottom) {
        navLinks.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
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
  ".hero__inner, .about__grid, .skills__group, .project-card, .civilization__preview, .contact__inner",
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

/* ── Contact form (basic UX) ── */
const form = document.querySelector(".contact__form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const btn = form.querySelector("button[type='submit']");
  btn.textContent = "Message sent ✓";
  btn.disabled = true;
  btn.style.opacity = "0.6";
  form.reset();
});

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
    "a, button, .btn, .skill-badge, .project-card, .nav__hamburger, input, textarea";

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
