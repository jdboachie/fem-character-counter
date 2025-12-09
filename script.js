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

let view = {
  characterLimitToggle: document.getElementById("character-limit-toggle"),
  characterLimitInput: document.getElementById("character-limit-input"),
  characterCountDisplay: document.getElementById("character-count-display"),
  letterDensityView: document.getElementById("letter-density-view"),
  readTimeDisplay: document.getElementById("read-time-display"),
  sentenceCountDisplay: document.getElementById("sentence-count-display"),
  textarea: document.getElementById("textarea"),
  textareaErrorLabel: document.getElementById("textarea-error-label"),
  whitespaceToggle: document.getElementById("whitespace-toggle"),
  wordCountDisplay: document.getElementById("word-count-display"),

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

  toggleCharacterLimitInput(visible) {
    if (visible === true) {
      this.characterLimitInput.style.visibility = "visible";
    } else {
      this.characterLimitInput.style.visibility = "hidden";
    }
  },
};

let counter = {
  characterCount: 0,
  characterLimit: 0,
  readTime: 0,
  sentenceCount: 0,
  shouldExcludeWhitespace: false,
  shouldUseCharacterLimit: false,
  wordCount: 0,
  WPM: 200,

  getCharacterCounts(text) {
    let counts = {};
    for (const char of text.toUpperCase()) {
      if (/[A-Z]/.test(char)) counts[char] = (counts[char] || 0) + 1;
    }
    return counts;
  },

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

  setExcludeWhitespace(shouldExcludeWhitespace) {
    this.shouldExcludeWhitespace = shouldExcludeWhitespace;
  },

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

  setUseCharacterLimit(shouldUseCharacterLimit) {
    this.shouldUseCharacterLimit = shouldUseCharacterLimit;
  },

  updateCharacterCount(text) {
    if (this.shouldExcludeWhitespace) {
      this.characterCount = text.replace(/\s/g, "").length;
    } else {
      this.characterCount = text.length;
    }
  },

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
