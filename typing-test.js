/**
 * Mini Typing Test for Luke Dongque's Portfolio
 * Triggered via 'T', 'Ctrl+K', or clicking the floating indicator.
 */

(() => {
  const QUOTES = [
    {
      text: "Talk is cheap. Show me the code.",
      author: "Linus Torvalds",
      category: "Wisdom",
    },
    {
      text: "First, solve the problem. Then, write the code.",
      author: "John Johnson",
      category: "Architecture",
    },
    {
      text: "There are only 10 kinds of people: those who understand binary, and those who don't.",
      author: "Anonymous",
      category: "Classic",
    },
    {
      text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
      author: "Martin Fowler",
      category: "Clean Code",
    },
    {
      text: "Premature optimization is the root of all evil.",
      author: "Donald Knuth",
      category: "Performance",
    },
    {
      text: "const developer = { coffee: Infinity, bugs: 0, status: 'shipping' };",
      author: "JavaScript",
      category: "Code Snippet",
    },
    {
      text: "function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }",
      author: "Async JS",
      category: "Code Snippet",
    },
    {
      text: "Simplicity is prerequisite for reliability.",
      author: "Edsger Dijkstra",
      category: "Architecture",
    },
    {
      text: "git commit -m 'Fixed a bug that was bothering me for 3 days'",
      author: "Git Log",
      category: "Daily Life",
    },
    {
      text: "It is not a bug, it is an undocumented feature.",
      author: "Dev Lore",
      category: "Humor",
    },
    {
      text: "Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live.",
      author: "John Woods",
      category: "Maintenance",
    },
  ];

  // DOM Elements Injection
  function injectModalHTML() {
    if (document.querySelector(".typing-modal")) return;

    const modalHTML = `
      <!-- Trigger Badge -->
      <div class="typing-test-badge" id="typing-trigger-badge" title="Press 'T' or Ctrl+K anytime">
        <span>Speed Test</span>
        <kbd>T</kbd>
      </div>

      <!-- Modal Window -->
      <div class="typing-modal" id="typing-modal" aria-hidden="true" role="dialog" aria-label="Terminal Typing Test">
        <div class="typing-window">
          <!-- Terminal Header -->
          <div class="typing-header">
            <div class="typing-header__left">
              <div class="typing-dots">
                <span class="typing-dot typing-dot--red"></span>
                <span class="typing-dot typing-dot--yellow"></span>
                <span class="typing-dot typing-dot--green"></span>
              </div>
              <span class="typing-title">luke@portfolio:~/speed-test$</span>
            </div>
            <button class="typing-header__close" id="typing-close-btn" aria-label="Close test">
              <span>Esc</span>
              <kbd>✕</kbd>
            </button>
          </div>

          <!-- Stats HUD -->
          <div class="typing-hud">
            <div class="typing-stat">
              <span class="typing-stat__label">Speed</span>
              <span class="typing-stat__value typing-stat__value--accent" id="typing-wpm">0 <span style="font-size:1.2rem;font-weight:400;color:#adb5bd;">WPM</span></span>
            </div>
            <div class="typing-stat">
              <span class="typing-stat__label">Accuracy</span>
              <span class="typing-stat__value" id="typing-acc">100%</span>
            </div>
            <div class="typing-stat">
              <span class="typing-stat__label">Time</span>
              <span class="typing-stat__value" id="typing-time">0.0s</span>
            </div>
            <div class="typing-stat">
              <span class="typing-stat__label">Personal Best</span>
              <span class="typing-stat__value" id="typing-best">--</span>
            </div>
            <div class="typing-meta">
              <span class="typing-mode-tag" id="typing-category">Wisdom</span>
              <span id="typing-author" style="font-size: 1.1rem; color: #8c95a5;">— Linus Torvalds</span>
            </div>
          </div>

          <!-- Body Arena -->
          <div class="typing-body" id="typing-body">
            <input type="text" class="typing-input-hidden" id="typing-hidden-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
            
            <div class="typing-prompt" id="typing-prompt"></div>

            <!-- Results View -->
            <div class="typing-results" id="typing-results">
              <h3 class="typing-results__title">Test Complete!</h3>
              <div class="typing-results__rank" id="typing-rank">Terminal Wizard</div>
              <div class="typing-results__grid">
                <div class="typing-result-card">
                  <div class="typing-result-card__label">Speed</div>
                  <div class="typing-result-card__val" id="res-wpm" style="color:#5af78e;">72 WPM</div>
                </div>
                <div class="typing-result-card">
                  <div class="typing-result-card__label">Accuracy</div>
                  <div class="typing-result-card__val" id="res-acc">98%</div>
                </div>
                <div class="typing-result-card">
                  <div class="typing-result-card__label">Time</div>
                  <div class="typing-result-card__val" id="res-time">12.4s</div>
                </div>
                <div class="typing-result-card">
                  <div class="typing-result-card__label">Mistakes</div>
                  <div class="typing-result-card__val" id="res-errors">2</div>
                </div>
              </div>

              <div class="typing-results__actions">
                <button class="typing-btn typing-btn--primary" id="typing-restart-btn">Try Again <kbd style="margin-left:4px;font-size:1rem;">↵</kbd></button>
                <button class="typing-btn" id="typing-next-btn">New Quote <kbd style="margin-left:4px;font-size:1rem;">Tab</kbd></button>
              </div>
            </div>
          </div>

          <!-- Terminal Footer -->
          <div class="typing-footer">
            <div class="typing-footer__shortcuts">
              <span class="typing-footer__item"><kbd>Tab</kbd> New Quote</span>
              <span class="typing-footer__item"><kbd>Esc</kbd> Close</span>
              <span class="typing-footer__item"><kbd>Ctrl</kbd>+<kbd>K</kbd> Toggle</span>
            </div>
            <div>
              <button class="typing-btn" id="typing-newquote-btn" style="padding: 0.3rem 0.8rem; font-size: 1.1rem;">Change Quote ↻</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = modalHTML;
    document.body.appendChild(wrapper);
  }

  // State
  let isOpen = false;
  let currentQuote = null;
  let quoteIndex = 0;
  let currentIndex = 0;
  let charStatus = []; // 'untyped', 'correct', 'incorrect'
  let startTime = null;
  let timerId = null;
  let totalTyped = 0;
  let errorsCount = 0;
  let isFinished = false;

  // DOM element refs
  let modal, badge, closeBtn, promptEl, resultsEl, hiddenInput;
  let wpmEl, accEl, timeEl, bestEl, categoryEl, authorEl;
  let resWpmEl, resAccEl, resTimeEl, resErrorsEl, resRankEl;
  let restartBtn, nextBtn, newQuoteBtn, typingBody;

  function initRefs() {
    modal = document.getElementById("typing-modal");
    badge = document.getElementById("typing-trigger-badge");
    closeBtn = document.getElementById("typing-close-btn");
    promptEl = document.getElementById("typing-prompt");
    resultsEl = document.getElementById("typing-results");
    hiddenInput = document.getElementById("typing-hidden-input");
    wpmEl = document.getElementById("typing-wpm");
    accEl = document.getElementById("typing-acc");
    timeEl = document.getElementById("typing-time");
    bestEl = document.getElementById("typing-best");
    categoryEl = document.getElementById("typing-category");
    authorEl = document.getElementById("typing-author");
    resWpmEl = document.getElementById("res-wpm");
    resAccEl = document.getElementById("res-acc");
    resTimeEl = document.getElementById("res-time");
    resErrorsEl = document.getElementById("res-errors");
    resRankEl = document.getElementById("typing-rank");
    restartBtn = document.getElementById("typing-restart-btn");
    nextBtn = document.getElementById("typing-next-btn");
    newQuoteBtn = document.getElementById("typing-newquote-btn");
    typingBody = document.getElementById("typing-body");
  }

  function getPersonalBest() {
    return parseInt(localStorage.getItem("luke_typing_best_wpm") || "0", 10);
  }

  function setPersonalBest(wpm) {
    const current = getPersonalBest();
    if (wpm > current) {
      localStorage.setItem("luke_typing_best_wpm", wpm.toString());
      return true;
    }
    return false;
  }

  function updateBestDisplay() {
    const best = getPersonalBest();
    if (best > 0) {
      bestEl.textContent = `${best} WPM`;
    } else {
      bestEl.textContent = "--";
    }
  }

  function getRank(wpm, acc) {
    if (acc < 80) return "Keyboard Smasher";
    if (wpm >= 105) return "10x Developer God";
    if (wpm >= 85) return "Keyboard Ninja";
    if (wpm >= 65) return "Terminal Wizard";
    if (wpm >= 45) return "Full Stack Typist";
    if (wpm >= 30) return "Code Explorer";
    return "Console Novice";
  }

  function loadQuote(index = null) {
    if (index === null) {
      quoteIndex = Math.floor(Math.random() * QUOTES.length);
    } else {
      quoteIndex = (index + QUOTES.length) % QUOTES.length;
    }
    currentQuote = QUOTES[quoteIndex];
    resetTestState();
  }

  function resetTestState() {
    clearInterval(timerId);
    timerId = null;
    startTime = null;
    currentIndex = 0;
    totalTyped = 0;
    errorsCount = 0;
    isFinished = false;

    categoryEl.textContent = currentQuote.category;
    authorEl.textContent = `— ${currentQuote.author}`;

    wpmEl.innerHTML = `0 <span style="font-size:1.2rem;font-weight:400;color:#adb5bd;">WPM</span>`;
    accEl.textContent = "100%";
    timeEl.textContent = "0.0s";
    updateBestDisplay();

    // Render characters
    charStatus = new Array(currentQuote.text.length).fill("untyped");
    renderPrompt();

    promptEl.style.display = "block";
    resultsEl.classList.remove("is-visible");

    // Focus input
    focusInput();
  }

  function renderPrompt() {
    const text = currentQuote.text;
    let html = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const status = charStatus[i];
      let classes = `char char--${status}`;
      if (i === currentIndex && !isFinished) {
        classes += " char--current";
      }
      // handle spaces
      const displayChar = char === " " ? "&nbsp;" : escapeHtml(char);
      html += `<span class="${classes}" data-index="${i}">${displayChar}</span>`;
    }
    promptEl.innerHTML = html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function focusInput() {
    if (hiddenInput) {
      hiddenInput.value = "";
      hiddenInput.focus({ preventScroll: true });
    }
  }

  function openModal() {
    if (isOpen) return;
    isOpen = true;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (!currentQuote) {
      loadQuote();
    } else {
      resetTestState();
    }
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearInterval(timerId);
    timerId = null;
  }

  function toggleModal() {
    if (isOpen) closeModal();
    else openModal();
  }

  function startTimerIfNeeded() {
    if (!startTime) {
      startTime = performance.now();
      timerId = setInterval(() => {
        if (!startTime || isFinished) return;
        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
        timeEl.textContent = `${elapsedSec}s`;
        updateStats();
      }, 100);
    }
  }

  function updateStats() {
    if (!startTime) return;
    const elapsedMinutes = (performance.now() - startTime) / 60000;
    const correctCount = charStatus.filter((s) => s === "correct").length;

    // WPM = (correct chars / 5) / minutes
    const wpm =
      elapsedMinutes > 0 ? Math.round(correctCount / 5 / elapsedMinutes) : 0;
    wpmEl.innerHTML = `${wpm} <span style="font-size:1.2rem;font-weight:400;color:#adb5bd;">WPM</span>`;

    // Accuracy
    const acc =
      totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;
    accEl.textContent = `${acc}%`;

    return { wpm, acc };
  }

  function finishTest() {
    isFinished = true;
    clearInterval(timerId);
    timerId = null;

    const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(1);
    const { wpm, acc } = updateStats();

    setPersonalBest(wpm);
    updateBestDisplay();

    // Show Results
    promptEl.style.display = "none";
    resultsEl.classList.add("is-visible");

    resWpmEl.textContent = `${wpm} WPM`;
    resAccEl.textContent = `${acc}%`;
    resTimeEl.textContent = `${elapsedSeconds}s`;
    resErrorsEl.textContent = errorsCount;
    resRankEl.textContent = getRank(wpm, acc);
  }

  function processChar(key) {
    if (isFinished || !currentQuote) return;
    startTimerIfNeeded();

    const expectedChar = currentQuote.text[currentIndex];
    totalTyped++;

    if (key === expectedChar) {
      charStatus[currentIndex] = "correct";
    } else {
      charStatus[currentIndex] = "incorrect";
      errorsCount++;
    }

    currentIndex++;

    if (currentIndex >= currentQuote.text.length) {
      renderPrompt();
      finishTest();
    } else {
      renderPrompt();
      updateStats();
    }
  }

  function handleKeyInput(e) {
    if (!isOpen) return;

    // Handle Tab to get new quote
    if (e.key === "Tab") {
      e.preventDefault();
      loadQuote(quoteIndex + 1);
      return;
    }

    // Results screen navigation
    if (isFinished) {
      if (e.key === "Enter") {
        e.preventDefault();
        resetTestState();
      }
      return;
    }

    // Backspace
    if (e.key === "Backspace") {
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        charStatus[currentIndex] = "untyped";
        renderPrompt();
        updateStats();
      }
      return;
    }

    // Ignore modifier keys, navigation, and functional keys
    if (e.key.length > 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    e.preventDefault();
    processChar(e.key);
  }

  // Global triggers
  function setupEventListeners() {
    window.addEventListener("keydown", (e) => {
      // Toggle modal with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleModal();
        return;
      }

      // Close modal on Escape
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeModal();
        return;
      }

      // Open on 'T' or 't' if not typing in form inputs
      if (
        e.key.toLowerCase() === "t" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isOpen
      ) {
        const active = document.activeElement;
        const isInput =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.isContentEditable);

        if (!isInput) {
          e.preventDefault();
          openModal();
          return;
        }
      }

      // If modal is active, send keystrokes to typing handler
      if (isOpen) {
        handleKeyInput(e);
      }
    });

    // Badge click
    badge.addEventListener("click", () => {
      openModal();
    });

    // Close button
    closeBtn.addEventListener("click", () => {
      closeModal();
    });

    // Click backdrop to close
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Focus input on body click
    typingBody.addEventListener("click", () => {
      focusInput();
    });

    // Support mobile virtual keyboards
    hiddenInput.addEventListener("input", (e) => {
      if (!isOpen || isFinished) return;
      if (e.inputType === "deleteContentBackward") {
        if (currentIndex > 0) {
          currentIndex--;
          charStatus[currentIndex] = "untyped";
          renderPrompt();
          updateStats();
        }
      } else if (e.data) {
        for (let i = 0; i < e.data.length; i++) {
          processChar(e.data[i]);
        }
      }
      hiddenInput.value = "";
    });

    // Action buttons
    restartBtn.addEventListener("click", () => {
      resetTestState();
    });

    nextBtn.addEventListener("click", () => {
      loadQuote(quoteIndex + 1);
    });

    newQuoteBtn.addEventListener("click", () => {
      loadQuote(quoteIndex + 1);
    });
  }

  // Initialize
  function init() {
    injectModalHTML();
    initRefs();
    setupEventListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
