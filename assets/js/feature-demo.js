// Interactive, local-only chat demonstration for the public Features page.
// This is a UI preview: it never sends a message or accesses the visitor's contacts.
const root = document.querySelector("[data-chat-demo]");

if (root) {
  const thread = root.querySelector("[data-demo-thread]");
  const form = root.querySelector("[data-demo-form]");
  const input = root.querySelector("[data-demo-input]");
  const notice = root.querySelector("[data-demo-notice]");
  const send = root.querySelector("[data-demo-send]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let replyTimer = 0;
  let voiceTimer = 0;
  let autoStarted = false;

  const stamp = () => new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const scrollToLatest = () => { thread.scrollTop = thread.scrollHeight; };
  const notify = (message) => {
    notice.textContent = message;
    notice.classList.add("is-visible");
    clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => notice.classList.remove("is-visible"), 2300);
  };
  const addMessage = (text, side = "outgoing", extraClass = "") => {
    const bubble = document.createElement("article");
    bubble.className = "frf-msg frf-msg--" + side + (extraClass ? " " + extraClass : "");
    const body = document.createElement("p");
    body.textContent = text;
    const meta = document.createElement("time");
    meta.textContent = stamp();
    if (side === "outgoing") {
      const ticks = document.createElement("span");
      ticks.className = "frf-chat-ticks";
      ticks.textContent = "✓✓";
      ticks.setAttribute("aria-label", "Sent in demo");
      meta.append(" ", ticks);
    }
    bubble.append(body, meta);
    thread.append(bubble);
    scrollToLatest();
    return bubble;
  };
  const showTyping = () => {
    let typing = thread.querySelector("[data-demo-typing]");
    if (typing) return typing;
    typing = document.createElement("div");
    typing.className = "frf-typing";
    typing.dataset.demoTyping = "";
    typing.setAttribute("aria-label", "Daniel is typing");
    typing.innerHTML = "<span></span><span></span><span></span><small>Daniel is typing</small>";
    thread.append(typing);
    scrollToLatest();
    return typing;
  };
  const reply = (text) => {
    const typing = showTyping();
    window.setTimeout(() => {
      typing.remove();
      addMessage(text, "incoming");
    }, reduceMotion ? 120 : 850);
  };
  const updateSend = () => { send.disabled = !input.value.trim(); };
  const resetReply = () => window.clearTimeout(replyTimer);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    resetReply();
    addMessage(text);
    input.value = "";
    updateSend();
    const responses = [
      "Thanks, Amaka. I’ll check that and get back to you here.",
      "That works for me. I can share the details right here.",
      "No problem — I’ll send the property information in this chat."
    ];
    replyTimer = window.setTimeout(() => reply(responses[Math.floor(Math.random() * responses.length)]), 420);
  });

  input.addEventListener("input", updateSend);
  root.querySelectorAll("[data-demo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.demoAction;
      if (action === "back") {
        notify("You are viewing a sample conversation.");
      } else if (action === "attach") {
        const file = document.createElement("article");
        file.className = "frf-msg frf-msg--outgoing frf-msg--attachment";
        file.innerHTML = '<span class="frf-demo-doc" aria-hidden="true">PDF</span><span class="frf-demo-doc-copy"><b>Property floor plan.pdf</b><small>471 KB · Sample file</small></span>';
        const time = document.createElement("time");
        time.textContent = stamp() + " · demo";
        file.append(time);
        thread.append(file);
        scrollToLatest();
        notify("Sample attachment added — nothing was uploaded.");
      } else if (action === "voice-call") {
        notify("Call preview only — no call was placed.");
      } else if (action === "video-call") {
        notify("Video-call preview only — no call was placed.");
      } else if (action === "quick-reply") {
        input.value = "Thursday at 4 PM works for me.";
        updateSend();
        input.focus();
      }
    });
  });

  const voice = root.querySelector("[data-demo-voice]");
  if (voice) {
    voice.addEventListener("click", () => {
      const playing = voice.classList.toggle("is-playing");
      voice.setAttribute("aria-pressed", String(playing));
      voice.querySelector("[data-voice-icon]").innerHTML = playing
        ? '<path d="M9 5v14M15 5v14"/>'
        : '<use href="../assets/img/sprite.svg#play"/>';
      notify(playing ? "Playing sample voice note…" : "Voice note paused.");
      window.clearTimeout(voiceTimer);
      if (playing) voiceTimer = window.setTimeout(() => {
        voice.classList.remove("is-playing");
        voice.setAttribute("aria-pressed", "false");
        voice.querySelector("[data-voice-icon]").innerHTML = '<use href="../assets/img/sprite.svg#play"/>';
        notify("Sample voice note finished.");
      }, reduceMotion ? 500 : 2300);
    });
  }

  // A small automatic preview gives the phone a live feel; the visitor can still type at any time.
  const playIntro = () => {
    if (autoStarted) return;
    autoStarted = true;
    const reducedDelay = reduceMotion ? 180 : 900;
    window.setTimeout(() => {
      if (!root.isConnected) return;
      const typing = showTyping();
      window.setTimeout(() => {
        if (!root.isConnected) return;
        typing.remove();
        addMessage("I can send the floor plan here too, Amaka.", "incoming");
      }, reduceMotion ? 120 : 950);
    }, reducedDelay);
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        playIntro();
        observer.disconnect();
      }
    }, { threshold: 0.22 });
    observer.observe(root);
  } else {
    window.setTimeout(playIntro, 600);
  }
  updateSend();
}