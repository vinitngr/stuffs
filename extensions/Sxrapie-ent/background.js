// Match any company page (main, about, life, jobs, etc.)
const URL_PATTERN = /\/company\/[^\/]+/;
const capturedUrls = new Set();

/**
 * MAIN EXTRACTION FUNCTION
 * Runs inside the web page context with multiple fallback selectors
 */
function stealthExtractAndParse() {
  const html = document.documentElement.outerHTML;
  const url = window.location.href;
  const docTitle = document.title;

  // --- HELPER FUNCTIONS ---
  const cleanText = (text) => {
    if (!text) return null;
    let cleaned = text.replace(/\.\.\.\s*see more/gi, "");
    cleaned = cleaned.replace(/…\s*see more/gi, "");
    cleaned = cleaned.replace(/Show less/gi, "");
    return cleaned.replace(/\s+/g, " ").trim() || null;
  };

  // Try multiple selectors and return first match
  const getTextMulti = (selectors) => {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const text = cleanText(el.textContent);
          if (text && text.length > 1) return text;
        }
      } catch (e) {}
    }
    return null;
  };

  const getAttrMulti = (selectors, attr) => {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const value = el.getAttribute(attr);
          if (value) return value;
        }
      } catch (e) {}
    }
    return null;
  };

  // --- 1. IDENTITY (Multiple fallback selectors) ---
  const name = getTextMulti([
    "h1.org-top-card-summary__title",
    "h1.top-card-layout__title",
    "h1.org-top-card__primary-content span[dir='ltr']",
    ".org-top-card-summary h1",
    "[data-test-id='org-top-card-primary-content'] h1",
    "h1.ember-view",
    ".top-card-layout__entity-info h1",
    "h1"
  ]) || docTitle.split('|')[0].split(':')[0].trim();

  const tagline = getTextMulti([
    ".org-top-card-summary__tagline",
    ".top-card-layout__headline",
    ".org-top-card-summary-info-list + p",
    "[data-test-id='org-top-card-primary-content'] .text-body-small",
    ".org-page-details__tagline"
  ]);

  const logo = getAttrMulti([
    ".org-top-card-primary-content__logo",
    ".org-top-card-primary-content__logo-container img",
    ".top-card-layout__entity-image img",
    ".EntityPhoto-circle-9 img",
    ".org-top-card__logo img",
    "img.org-top-card-primary-content__logo",
    "[data-test-id='org-top-card-primary-content'] img",
    ".artdeco-entity-image img"
  ], "src");

  // --- 2. DETAILS (Industry, Location, Size, Followers) ---
  let industry = null;
  let location = null;
  let followerCount = null;
  let companySize = null;

  // Try multiple info item selectors
  const infoSelectors = [
    ".org-top-card-summary-info-list .org-top-card-summary-info-list__info-item",
    ".org-top-card-summary-info-list__info-item",
    ".top-card-layout__first-subline span",
    ".org-top-card-summary div.text-body-small",
    "[data-test-id='org-top-card-summary'] span"
  ];

  for (const selector of infoSelectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach((item) => {
        const text = cleanText(item.textContent);
        if (!text) return;

        const lowerText = text.toLowerCase();
        if (lowerText.includes("follower")) {
          if (!followerCount) followerCount = text;
        } else if (lowerText.includes("employee") || /^\d[\d,\-\+\s]+employee/i.test(text) || /^\d+[\-\+]?\s*$/.test(text.replace(/,/g, ''))) {
          if (!companySize) companySize = text;
        } else if (text.includes(",") && !lowerText.includes("employee")) {
          if (!location) location = text;
        } else if (!industry && text.length > 2 && !lowerText.includes("see all")) {
          industry = text;
        }
      });
      if (followerCount || location || industry) break;
    }
  }

  // Dedicated size selectors
  if (!companySize) {
    companySize = getTextMulti([
      ".org-top-card-summary-info-list__info-item-link",
      "a[href*='people']",
      ".org-about-company-module__company-size-definition-text",
      "[data-test-id='about-us__size'] dd"
    ]);
  }

  // --- 3. WEBSITE ---
  let website = getAttrMulti([
    "a[data-test-id='about-us__website']",
    ".org-top-card-primary-actions__action[href*='http']",
    "a.link-without-visited-state[href*='http']:not([href*='linkedin'])",
    ".org-about-us-organization-description a[href*='http']"
  ], "href");

  if (!website) {
    const allLinks = document.querySelectorAll("a[href]");
    for (const link of allLinks) {
      const text = link.textContent?.toLowerCase() || "";
      const href = link.getAttribute("href") || "";
      if ((text.includes("visit website") || text.includes("website")) && 
          href.startsWith("http") && !href.includes("linkedin.com")) {
        website = href;
        break;
      }
    }
  }

  // --- 4. ABOUT (Multiple fallbacks) ---
  let about = getTextMulti([
    ".organization-about-module__content-consistant-cards-description",
    ".org-about-us-organization-description__text",
    ".org-page-details__definition-text",
    "[data-test-id='about-us__description']",
    ".org-about-company-module__description",
    "section.artdeco-card .break-words",
    ".org-grid__right-rail .break-words",
    ".org-about-module p.break-words",
    ".core-section-container__content p",
    ".org-top-card-summary__description"
  ]);

  // Try to get about from any paragraph in about section
  if (!about) {
    const aboutSections = document.querySelectorAll("section");
    for (const section of aboutSections) {
      const header = section.querySelector("h2, h3");
      if (header && header.textContent?.toLowerCase().includes("about")) {
        const p = section.querySelector("p, .break-words, div[dir='ltr']");
        if (p) {
          about = cleanText(p.textContent);
          if (about && about.length > 50) break;
        }
      }
    }
  }

  if (about && about.length > 2500) {
    about = about.substring(0, 2500) + "...";
  }

  // --- 5. ADDITIONAL DETAILS FROM ABOUT MODULE ---
  const getDetailField = (labels) => {
    const dts = document.querySelectorAll("dt, .org-page-details__definition-term");
    for (const dt of dts) {
      const dtText = dt.textContent?.toLowerCase() || "";
      if (labels.some(l => dtText.includes(l))) {
        const dd = dt.nextElementSibling;
        if (dd) return cleanText(dd.textContent);
      }
    }
    return null;
  };

  if (!industry) industry = getDetailField(["industry", "industries"]);
  if (!companySize) companySize = getDetailField(["company size", "size"]);
  if (!location) location = getDetailField(["headquarters", "location"]);
  if (!website) website = getDetailField(["website"]);

  // --- 6. RECENT POSTS ---
  const recentPosts = [];
  const postSelectors = [
    ".feed-shared-update-v2",
    ".occludable-update",
    "[data-urn*='activity']"
  ];
  
  for (const selector of postSelectors) {
    const updates = document.querySelectorAll(selector);
    if (updates.length > 0) {
      updates.forEach((update, index) => {
        if (index >= 3) return;
        const textEl = update.querySelector(".update-components-text, .feed-shared-text, .break-words");
        if (textEl) {
          const postText = cleanText(textEl.textContent);
          if (postText && postText.length > 10) {
            recentPosts.push({ text: postText.substring(0, 200) + "..." });
          }
        }
      });
      if (recentPosts.length > 0) break;
    }
  }

  const profileIdMatch = url.match(/\/company\/([^\/\?]+)/);
  const companyId = profileIdMatch ? profileIdMatch[1] : null;

  // Debug: Log what we found
  console.log("[Ghost Debug] Extracted:", { name, tagline, industry, location, followerCount, companySize, about: about?.substring(0, 100) });

  return {
    url,
    companyId,
    extractedAt: new Date().toISOString(),
    identity: { name, tagline, logo, followerCount },
    details: { about, industry, location, website, size: companySize },
    content: { recentPosts },
    pageTitle: docTitle,
    rawHtmlSize: html.length,
  };
}

/**
 * PREPARATION FUNCTION
 * Just waits for page content to stabilize - NO SCROLLING to avoid detection
 */
function waitForContentStable() {
  return new Promise((resolve) => {
    let lastLength = 0;
    let stableCount = 0;

    const checkStable = setInterval(() => {
      const currentLength = document.body.innerText.length;

      if (currentLength === lastLength && currentLength > 500) {
        stableCount++;
        if (stableCount >= 4) {
          clearInterval(checkStable);
          resolve({ stable: true, length: currentLength });
        }
      } else {
        stableCount = 0;
        lastLength = currentLength;
      }
    }, 200);

    setTimeout(() => {
      clearInterval(checkStable);
      resolve({ stable: true, length: lastLength, timedOut: true });
    }, 3000);
  });
}

// --- CHROME EVENT LISTENERS ---

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url) return;

  try {
    const settings = await chrome.storage.local.get({ autoCapture: false });
    if (!settings.autoCapture) return;

    const url = new URL(tab.url);
    if (!URL_PATTERN.test(url.pathname)) return;

    if (capturedUrls.has(tab.url)) return;

    const stored = await chrome.storage.local.get({ scrapedData: {} });
    if (stored.scrapedData[tab.url]) return;

    console.log("[Ghost] ✓ Company URL detected (AUTO):", tab.url);
    chrome.action.setBadgeText({ text: "⏳" });
    chrome.action.setBadgeBackgroundColor({ color: "#ffaa00" });

    // Inject wait & scroll logic
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: waitForContentStable,
        world: "MAIN", // Use MAIN world to interact with page properly
      });
    } catch (e) { 
      console.log("[Ghost] Scroll script error (non-fatal):", e);
    }

    // Wait for LinkedIn's dynamic content to settle
    await new Promise((r) => setTimeout(r, 1500));
    await captureTab(tabId, tab.url, true);
    capturedUrls.add(tab.url);

  } catch (err) {
    console.error("[Ghost] Auto-capture error:", err);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "stealth-capture") {
    await captureCurrentTab();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture") {
    captureCurrentTab().then(sendResponse);
    return true;
  }
  if (request.action === "setAutoMode") {
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "getStats") {
    chrome.storage.local.get({ scrapedData: {} }, (result) => {
      const profiles = result.scrapedData;
      const urls = Object.keys(profiles);
      const dataStr = JSON.stringify(profiles);
      const sizeKB = (dataStr.length / 1024).toFixed(1);

      const summaries = urls.map((url) => ({
        url,
        companyId: profiles[url].companyId,
        name: profiles[url].name,
        captureMode: profiles[url].captureMode,
      }));

      sendResponse({
        count: urls.length,
        urls,
        summaries,
        sizeKB,
        totalRawHtml: urls.reduce((acc, url) => acc + (profiles[url].rawHtmlSize || 0), 0),
      });
    });
    return true;
  }
  if (request.action === "clearData") {
    chrome.storage.local.set({ scrapedData: {} }, () => {
      capturedUrls.clear();
      updateBadgeCount();
      sendResponse({ success: true });
    });
    return true;
  }
});

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { success: false, error: "No active tab" };
  
  chrome.action.setBadgeText({ text: "⏳" });
  chrome.action.setBadgeBackgroundColor({ color: "#ffaa00" });
  
  // Inject scroll/wait logic for manual capture too
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: waitForContentStable,
      world: "MAIN",
    });
  } catch (e) {
    console.log("[Ghost] Scroll script error (non-fatal):", e);
  }
  
  // Wait for content to load
  await new Promise((r) => setTimeout(r, 1500));
  
  return captureTab(tab.id, tab.url, false);
}

async function captureTab(tabId, url, isAuto) {
  try {
    if (url.startsWith("chrome://")) return { success: false, error: "Cannot capture browser pages" };

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: stealthExtractAndParse,
    });

    const data = results[0]?.result;
    if (!data || !data.identity?.name) {
      return { success: false, error: "Could not extract company data" };
    }

    const stored = await chrome.storage.local.get({ scrapedData: {} });

    stored.scrapedData[data.url] = {
      companyId: data.companyId,
      extractedAt: data.extractedAt,
      captureMode: isAuto ? "auto" : "manual",
      type: "company",
      name: data.identity.name,
      tagline: data.identity.tagline,
      logo: data.identity.logo,
      followerCount: data.identity.followerCount,
      about: data.details.about,
      industry: data.details.industry,
      location: data.details.location,
      website: data.details.website,
      size: data.details.size,
      recentPosts: data.content.recentPosts,
      pageTitle: data.pageTitle,
      rawHtmlSize: data.rawHtmlSize,
    };

    await chrome.storage.local.set({ scrapedData: stored.scrapedData });

    const badgeText = isAuto ? "C✓" : "M✓";
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: isAuto ? "#ff9900" : "#00AA00" });
    setTimeout(() => updateBadgeCount(), 2500);

    const savedSize = JSON.stringify(stored.scrapedData[data.url]).length;
    console.log(`[Ghost] ${isAuto ? "🤖 AUTO" : "👆 MANUAL"} captured:`, data.companyId);

    return {
      success: true,
      companyId: data.companyId,
      name: data.identity.name,
      savedSize,
      compression: `${Math.round((savedSize / data.rawHtmlSize) * 100)}%`,
      mode: isAuto ? "auto" : "manual",
    };
  } catch (err) {
    console.error("[Ghost] Capture failed:", err);
    chrome.action.setBadgeText({ text: "✗" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
    setTimeout(() => updateBadgeCount(), 2000);
    return { success: false, error: err.message };
  }
}

async function updateBadgeCount() {
  const result = await chrome.storage.local.get({ scrapedData: {} });
  const count = Object.keys(result.scrapedData).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#666" });
}

chrome.runtime.onStartup.addListener(updateBadgeCount);
chrome.runtime.onInstalled.addListener(updateBadgeCount);
updateBadgeCount();