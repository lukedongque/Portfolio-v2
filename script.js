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
  ".hero__inner, .about__grid, .skills__group, .project-card, .contact__inner",
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
