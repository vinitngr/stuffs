let tweetQueue = [];
let isProcessing = false;

function createTriggerButton() {
  if (document.getElementById("vibe-check-trigger")) return;

  const btn = document.createElement("button");
  btn.innerText = "✨ Check Vibes";
  btn.id = "vibe-check-trigger";
  
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    zIndex: "9999",
    padding: "12px 24px",
    backgroundColor: "#1d9bf0", 
    color: "white",
    border: "none",
    borderRadius: "30px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    fontSize: "16px",
    transition: "all 0.2s"
  });

  btn.onmouseover = () => btn.style.transform = "scale(1.05)";
  btn.onmouseout = () => btn.style.transform = "scale(1)";

  btn.onclick = async () => {
    if (tweetQueue.length === 0) {
      btn.innerText = "No new tweets!";
      setTimeout(() => btn.innerText = "✨ Check Vibes", 2000);
      return;
    }

    const originalText = btn.innerText;
    btn.innerText = `🔮 Scanning ${tweetQueue.length} tweets...`;
    btn.style.backgroundColor = "#7856ff";
    btn.disabled = true;

    while (tweetQueue.length > 0) {
      await processNextBatch();
      if (tweetQueue.length > 0) {
        btn.innerText = `🔮 Scanning ${tweetQueue.length} left...`;
      }
    }

    btn.innerText = "✨ Clean!";
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.backgroundColor = "#1d9bf0";
      btn.disabled = false;
    }, 1500);
  };

  document.body.appendChild(btn);
}

createTriggerButton();


const observer = new MutationObserver((mutations) => {
  if (!document.getElementById("vibe-check-trigger")) createTriggerButton();

  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  
  articles.forEach((article) => {
    if (article.dataset.vibeCheckId) return;

    const uniqueId = Math.random().toString(36).substr(2, 9);
    article.dataset.vibeCheckId = uniqueId;

    const userEl = article.querySelector('div[data-testid="User-Name"]');
    const userName = userEl ? userEl.innerText.replace(/\n/g, " ") : "Unknown";

    const textEl = article.querySelector('div[data-testid="tweetText"]');
    let tweetContent = textEl ? textEl.innerText : "[Media/Image Only]"; 
    
    const cleanText = tweetContent.slice(0, 250).replace(/\s+/g, " ").trim();

    tweetQueue.push({
      id: uniqueId,
      user: userName,
      text: cleanText
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });


async function processNextBatch() {
  const batch = tweetQueue.splice(0, 25);
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey', 'customPrompt'], async (items) => {
      if (!items.apiKey) {
        alert("Please set your API Key in the extension popup first!");
        resolve(); 
        return;
      }

      const systemInstruction = `
        You are a Content Filter.
        Analyze tweets. Return IDs for:
        1. Ragebait, toxic hostility, insults.
        2. "Idiot kind" engagement bait (e.g. "A or B?", "Wrong answers only").
        3. USER RULES: ${items.customPrompt || "None"}
        
        Return JSON ONLY: { "detected": ["id1", "id2"] }
      `;

      try {
        const response = await callGeminiAPI(items.apiKey, systemInstruction, JSON.stringify(batch));
        
        if (response && response.detected && response.detected.length > 0) {
          blurTweets(response.detected);
        }
      } catch (error) {
        console.error("Batch Error:", error);
      } finally {
      }
    });
  });
}


async function callGeminiAPI(apiKey, systemPrompt, userContent) {
  const model = "gemini-3-flash-preview"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: systemPrompt + "\n\nData:\n" + userContent }]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ API Error:", JSON.stringify(data, null, 2));
      return { detected: [] };
    }

    if (!data.candidates || data.candidates.length === 0) return { detected: [] };

    const textResponse = data.candidates[0].content.parts[0].text;
    return JSON.parse(textResponse);

  } catch (e) {
    console.error("Network Error:", e);
    return { detected: [] };
  }
}


function blurTweets(ids) {
  ids.forEach(id => {
    const article = document.querySelector(`article[data-vibe-check-id="${id}"]`);
    if (article) {
      const container = article.closest('div[data-testid="cellInnerDiv"]');
      if (container) {
        container.style.transition = "filter 0.5s ease, opacity 0.5s ease";
        container.style.filter = "blur(12px) grayscale(100%)"; 
        container.style.opacity = "0.15"; 
        container.style.pointerEvents = "none"; 
        console.log("Blurred:", id);
      }
    }
  });
}