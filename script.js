/**
 * Emitted when character statistics are recalculated
 */
class StatChangeEvent {
  constructor({ characterCount, wordCount, sentenceCount, readTime }) {
    this.characterCount = characterCount;
    this.readTime = readTime;
    this.sentenceCount = sentenceCount;
    this.wordCount = wordCount;
  }
}

/**
 * Emitted when the character limit is set, changed, or reached
 */
class CharacterLimitEvent {
  constructor({ isOverLimit, limit }) {
    this.isOverLimit = isOverLimit;
    this.limit = limit;
  }
}

/**
 * Emitted when letter density is recalculated
 */
class LetterDensityChangeEvent {
  constructor(densities) {
    this.densities = densities;
  }
}

/**
 * Debounce a callback function to limit its invocation rate.
 * @param {function} fn - the callback to debounce
 * @param {number} delay - milliseconds to wait before invoking fn
 * @returns {function(...args: any[]): void} debounced version of fn
 */
function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Pub - Sub architecture.
 * Publishes events, subscribes entities to events
 */
let pubsub = {
  events: {},

  publish(event, data) {
    if (!this.events[event]) return;
    for (const handler of this.events[event]) {
      handler(data);
    }
  },

  subscribe(event, handler) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(handler);
  },
};

/**
 * View provides a direct interface to the DOM
 */
let view = {
  appLogo: document.getElementById("app-logo"),
  characterLimitToggle: document.getElementById("character-limit-toggle"),
  characterLimitInput: document.getElementById("character-limit-input"),
  characterCountDisplay: document.getElementById("character-count-display"),
  letterDensityView: document.getElementById("letter-density-view"),
  readTimeDisplay: document.getElementById("read-time-display"),
  sentenceCountDisplay: document.getElementById("sentence-count-display"),
  settingsButtonIcon: document.getElementById("settings-button-icon"),
  textarea: document.getElementById("textarea"),
  textareaErrorLabel: document.getElementById("textarea-error-label"),
  themeToggle: document.getElementById("settings-button"),
  whitespaceToggle: document.getElementById("whitespace-toggle"),
  wordCountDisplay: document.getElementById("word-count-display"),

  /**
   * Generates HTML template for letter density view
   * @param {Record<string, any>} data - Data object containing letter density information
   * @returns {string} HTML template for letter density view
   */
  generateLetterDensityTemplate(data) {
    return `
      <li class="text-preset-4">
          <p class="label">${data.letter}</p>
          <div
              style="--progress-width: ${data.percent}%"
              class="progressbar"
          >
              <div class="progressbar__indicator"></div>
          </div>
          <p class="progressbar__detail">${data.count} (${data.percent.toFixed(2)}%)</p>
      </li>
    `;
  },

  /**
   * Updates the letter density view with the provided data
   * @param {Record<string, any>} event - Event object containing letter density information
   */
  updateLetterDensityView(event) {
    if (event.densities.length === 0) {
      this.letterDensityView.innerHTML =
        "No characters found. Start typing to see letter density.";
    } else {
      const items = app.shouldSeeMore
        ? event.densities
        : event.densities.slice(0, 5);

      this.letterDensityView.innerHTML = `
        <div class="density__container">
          <ul class="density__list v-flex">
            ${items.map((item) => this.generateLetterDensityTemplate(item)).join("")}
          </ul>
          ${
            event.densities.length > 5
              ? `
              <button class="seemore__button text-preset-3" tabindex="5">
                See ${app.shouldSeeMore ? "less" : "more"}
                <span
                  class="seemore__button__icon"
                  data-open="${app.shouldSeeMore}"
                ></span>
              </button>
            `
              : ""
          }
        </div>
      `;
    }
  },

  /**
   * Updates the character statistics view with the provided data
   * @param {Record<string, any>} data - new statistics to render
   */
  updateStats(data) {
    this.characterCountDisplay.textContent = data.characterCount;
    this.sentenceCountDisplay.textContent = data.sentenceCount;
    this.wordCountDisplay.textContent = data.wordCount;
    this.readTimeDisplay.textContent =
      data.readTime === 0
        ? "0 minutes"
        : data.readTime < 1
          ? "< 1 minute"
          : `${data.readTime.toFixed(2)} minutes`;
  },

  /**
   * Updates the letter density view with the provided data
   * @param {Record<string, any>} event - Event object containing letter density information
   */
  updateLetterDensityView(event) {
    if (event.densities.length === 0) {
      this.letterDensityView.innerHTML =
        '<li class="text-preset-4">No data available</li>';
    } else {
      this.letterDensityView.innerHTML = `
        <div class="density__container">
          <ul class="density__list v-flex">
            ${event.densities.map((item) => this.generateLetterDensityTemplate(item)).join("")}
          </ul>
          ${
            event.densities.length > 5
              ? `
              <button class="seemore__button text-preset-3" tabindex="5">
                See ${app.shouldSeeMore ? "less" : "more"}
                <span
                  class="seemore__button__icon"
                  data-open="${app.shouldSeeMore}"
                ></span>
              </button>
            `
              : ""
          }
        </div>
      `;
    }
  },
  
  /**
   * Toggles the error label visibility based on the provided event data
   * @param {Record<string, any>} event - Event object containing error information
   */
  toggleErrorLabel(event) {
    if (event.isOverLimit === true) {
      if (!this.textarea.classList.contains("error")) {
        this.textarea.classList.add("error");
      }
      this.textareaErrorLabel.textContent = `Limit reached! Your text exceeds ${event.limit ? event.limit + " characters" : "the limit"}.`;
    } else {
      this.textarea.classList.remove("error");
      this.textareaErrorLabel.textContent = "";
    }
  },

  /**
   * Toggles the character limit input visibility
   * @param {boolean} visible - Event object containing character limit information
   */
  toggleCharacterLimitInput(visible) {
    if (visible === true) {
      this.characterLimitInput.style.visibility = "visible";
    } else {
      this.characterLimitInput.style.visibility = "hidden";
    }
  },
};

/**
 * Counter Model - contains all the business logic for the application
 */
let counter = {
  characterCount: 0,
  characterLimit: 0,
  readTime: 0,
  sentenceCount: 0,
  shouldExcludeWhitespace: false,
  shouldUseCharacterLimit: false,
  wordCount: 0,
  WPM: 200,

  /**
   * Calculates the character counts for the given text
   * @param {string} text - The text to calculate character counts for
   * @returns {Record<string, number>} - Object containing character counts
   */
  getCharacterCounts(text) {
    let counts = {};
    for (const char of text.toUpperCase()) {
      if (/[A-Z]/.test(char)) counts[char] = (counts[char] || 0) + 1;
    }
    return counts;
  },

  /**
   * Calculates the letter densities for the given text
   * @param {string} text - The text to calculate letter densities for
   * @returns {Array<{letter: string, count: number, percent: number}>} - Array of objects containing letter densities
   */
  getLetterDensities(text) {
    const counts = this.getCharacterCounts(text);
    const totalLetters = Object.values(counts).reduce((a, b) => a + b, 0);

    const densities = Object.entries(counts)
      .map(([letter, count]) => ({
        letter,
        count,
        percent: (count / totalLetters) * 100,
      }))
      .sort((a, b) => b.percent - a.percent);

    pubsub.publish(
      "LetterDensityChangeEvent",
      new LetterDensityChangeEvent(densities),
    );
  },

  /**
   * Sets whether to exclude whitespace from character counts
   * @param {boolean} shouldExcludeWhitespace - Whether to exclude whitespace
   */
  setExcludeWhitespace(shouldExcludeWhitespace) {
    this.shouldExcludeWhitespace = shouldExcludeWhitespace;
  },

  /**
   * Sets the character limit for the text input
   * @param {number} limit - The character limit
   */
  setCharacterLimit(limit) {
    this.characterLimit = limit;
    pubsub.publish(
      "CharacterLimitEvent",
      new CharacterLimitEvent({
        isOverLimit: this.characterCount > this.characterLimit,
        limit: this.characterLimit,
      }),
    );
  },

  /**
   * Sets whether to use character limit for text input
   * @param {boolean} shouldUseCharacterLimit - Whether to use character limit
   */
  setUseCharacterLimit(shouldUseCharacterLimit) {
    this.shouldUseCharacterLimit = shouldUseCharacterLimit;
  },

  /**
   * Updates the character count based on the provided text
   * @param {string} text - The text to analyze
   */
  updateCharacterCount(text) {
    if (this.shouldExcludeWhitespace) {
      this.characterCount = text.replace(/\s/g, "").length;
    } else {
      this.characterCount = text.length;
    }
  },

  /**
   * Updates character count and publishes character limit event
   * @param {string} text - The text to analyze
   */
  updateStats(text) {
    this.updateCharacterCount(text);
    if (
      this.characterCount > this.characterLimit &&
      this.shouldUseCharacterLimit
    ) {
      pubsub.publish(
        "CharacterLimitEvent",
        new CharacterLimitEvent({
          isOverLimit: true,
          limit: this.characterLimit,
        }),
      );
    } else {
      pubsub.publish(
        "CharacterLimitEvent",
        new CharacterLimitEvent({
          isOverLimit: false,
          limit: this.characterLimit,
        }),
      );
    }

    this.wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    this.sentenceCount = text.trim().split(/[.!?]/).filter(Boolean).length;
    this.readTime = this.wordCount / this.WPM;

    pubsub.publish(
      "StatChangeEvent",
      new StatChangeEvent({
        characterCount: this.characterCount,
        wordCount: this.wordCount,
        sentenceCount: this.sentenceCount,
        readTime: this.readTime,
      }),
    );

    this.getLetterDensities(text);
  },
};

let app = {
  DEFAULT_CHARACTER_LIMIT: 300,
  shouldSeeMore: false,

  onTextareaInput: debounce((event) => {
    counter.updateStats(event.target.value);
  }, 100),

  onTextareaKeydown(e) {
    const text = e.target.value;
    const isOverLimit =
      counter.shouldUseCharacterLimit &&
      (counter.shouldExcludeWhitespace
        ? text.replace(/\s/g, "").length >= counter.characterLimit
        : text.length >= counter.characterLimit);

    const allowedKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Tab",
    ];
    if (isOverLimit && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  },

  onCharacterLimitInput(event) {
    counter.setCharacterLimit(event.target.value);
  },

  onToggleCharacterLimit(event) {
    view.toggleCharacterLimitInput(event.target.checked);
    counter.setUseCharacterLimit(event.target.checked);
    counter.updateStats(view.textarea.value);
  },

  onToggleWhitespace(event) {
    counter.setExcludeWhitespace(event.target.checked);
    counter.updateStats(view.textarea.value);
  },

  onToggleTheme(event) {
    document.documentElement.classList.toggle("dark");
    if (document.documentElement.classList.contains("dark")) {
      view.appLogo.src = "assets/images/logo-dark-theme.svg";
      view.settingsButtonIcon.src = "assets/images/icon-sun.svg"
    } else {
      view.appLogo.src = "assets/images/logo-light-theme.svg";
      view.settingsButtonIcon.src = "assets/images/icon-moon.svg"
    }
  },

  run() {
    view.characterLimitInput.addEventListener(
      "input",
      app.onCharacterLimitInput,
    );
    view.characterLimitToggle.addEventListener(
      "change",
      app.onToggleCharacterLimit,
    );
    view.textarea.addEventListener("input", app.onTextareaInput);
    view.textarea.addEventListener("keydown", app.onTextareaKeydown);
    view.themeToggle.addEventListener("click", app.onToggleTheme);
    view.whitespaceToggle.addEventListener("change", app.onToggleWhitespace);
    view.letterDensityView.addEventListener("click", (e) => {
      if (e.target.closest(".seemore__button")) {
        app.shouldSeeMore = !app.shouldSeeMore;
        counter.getLetterDensities(view.textarea.value);
      }
    });

    view.characterLimitInput.value = app.DEFAULT_CHARACTER_LIMIT;
    view.characterLimitToggle.checked = false;
    view.whitespaceToggle.checked = false;
    counter.setCharacterLimit(app.DEFAULT_CHARACTER_LIMIT);

    pubsub.subscribe("StatChangeEvent", (data) => {
      view.updateStats(data);
    });

    pubsub.subscribe("CharacterLimitEvent", (event) => {
      view.toggleErrorLabel(event);
    });

    pubsub.subscribe("LetterDensityChangeEvent", (event) => {
      view.updateLetterDensityView(event);
    });
  },
};

app.run();
