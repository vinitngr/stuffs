(() => {
  let busy = false;

  const CTX_START = "[CTX_START]";
  const CTX_END = "[CTX_END]";

  function ensurePanel(form) {
    let panel = document.getElementById("ctx-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "ctx-panel";
    panel.className = `
      hidden mb-2 max-h-28 overflow-y-auto rounded-[22px]
      border border-gray-200 bg-white
      px-4 py-3 text-sm text-gray-600
      shadow-[0_1px_2px_rgba(0,0,0,0.04)]
    `;

    panel.innerHTML = `<div class="space-y-2" id="ctx-steps"></div>`;
    form.parentElement.insertBefore(panel, form);
    return panel;
  }

  function addStep(container, text, done = false) {
    const row = document.createElement("div");
    row.className = "flex items-start gap-2";
    row.innerHTML = `
      <span class="mt-0.5 text-xs ${done ? "text-green-600" : "text-gray-400"}">
        ${done ? "●" : "○"}
      </span>
      <span class="flex-1">${text}</span>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  function transformBubble(bubble) {
    if (bubble.__ctx_done) return;

    const body = bubble.querySelector(".whitespace-pre-wrap");
    if (!body) return;

    const text = body.textContent;
    if (!text.includes(CTX_START)) return;

    const [, rest] = text.split(CTX_START);
    const [ctx] = rest.split(CTX_END);
    const query = text.split(CTX_START)[0].trim();

    body.textContent = query;

    const ctxBox = document.createElement("div");
    ctxBox.className = `
      mt-2 rounded-xl border 
      bg-[#ebe4d3] border-[#e6dcc7]
      px-3 py-2 text-xs text-gray-700
    `;

    ctxBox.innerHTML = `
     <details>
 <summary
  class="cursor-pointer select-none
         text-[10px] font-semibold uppercase
         text-gray-800
         bg-[#e8dfcc]
         px-2 py-0.5 rounded-md
         mb-1"
  style="
    display: list-item;
    list-style: disclosure-closed;
    list-style-position: inside;
  ">
  Context
</summary>


  <pre class="mt-1 whitespace-pre-wrap text-xs text-gray-700">
${ctx.trim()}
  </pre>
</details>
    `;

    bubble.appendChild(ctxBox);
    bubble.__ctx_done = true;
  }

  const chatObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        const bubble =
          node.querySelector?.(".user-message-bubble-color") ||
          (node.classList?.contains("user-message-bubble-color") ? node : null);

        if (bubble) transformBubble(bubble);
      }
    }
  });

  chatObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  function scanExistingBubbles() {
    document
      .querySelectorAll(".user-message-bubble-color")
      .forEach(transformBubble);
  }

  setTimeout(scanExistingBubbles, 500);
  setTimeout(scanExistingBubbles, 1500);
  setTimeout(scanExistingBubbles, 3000);

  function inject() {
    const form = document.querySelector("form.group\\/composer");
    const editor = document.querySelector("#prompt-textarea");
    const sendBtn = document.querySelector("#composer-submit-button");

    if (!form || !editor || !sendBtn) return;
    if (sendBtn.__ctx_hooked) return;

    sendBtn.__ctx_hooked = true;
    sendBtn.__ctx_allow = false;

    sendBtn.addEventListener(
      "click",
      (e) => {
        if (sendBtn.__ctx_allow) {
          sendBtn.__ctx_allow = false;
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();
        if (busy) return;
        busy = true;

        const panel = ensurePanel(form);
        const list = panel.querySelector("#ctx-steps");
        list.innerHTML = "";
        panel.classList.remove("hidden");

        const es = new EventSource("http://127.0.0.1:3000/context/stream");

        es.addEventListener("step", (ev) => {
          const { label } = JSON.parse(ev.data);
          addStep(list, label);
        });

        es.addEventListener("done", (ev) => {
          const { context } = JSON.parse(ev.data);

          addStep(list, "Done", true);

          editor.focus();
          document.execCommand(
            "insertText",
            false,
            `\n${CTX_START}\n${context}\n${CTX_END}\n`
          );
          editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

          es.close();
          busy = false;

          setTimeout(() => {
            panel.classList.add("hidden");
            sendBtn.__ctx_allow = true;
            sendBtn.click();
          }, 300);
        });

        es.onerror = () => {
          addStep(list, "Context fetch failed", true);
          es.close();
          busy = false;
        };
      },
      true
    );
  }

  new MutationObserver(inject).observe(document.body, {
    childList: true,
    subtree: true,
  });

  inject();
})();
