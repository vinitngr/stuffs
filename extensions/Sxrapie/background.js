const URL_PATTERN = /\/in\/[^\/]+\/?$/;

const capturedUrls = new Set();

function stealthExtractAndParse() {
  const html = document.documentElement.outerHTML;
  const url = window.location.href;
  const title = document.title;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const getText = (selector) => {
    const el = doc.querySelector(selector);
    return el ? el.textContent.trim() : null;
  };

  const getAttr = (selector, attr) => {
    const el = doc.querySelector(selector);
    return el ? el.getAttribute(attr) : null;
  };

  const cleanText = (text) => {
    if (!text) return null;
    return text.replace(/\s+/g, " ").trim();
  };

  return {
    url,
    profileId,
    extractedAt: new Date().toISOString(),

    identity: {
      fullName,
      headline,
      pronouns,
    },

    about: aboutText,

    affiliations: {
      currentCompany,
      education,
    },

    experience: experienceItems,

    educationList: educationItems,
    projectsList : projectItems,
    certifications: certifications,

    skills: skillsList,

    locationInfo: {
      location,
      portfolioUrl: portfolioLink,
    },

    network: {
      connections: connections ? parseInt(connections) : null,
    },
    activities : activityData,

    profileImage: profileImg,

    pageTitle: title,
    rawHtmlSize: html.length,
  };
}

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
    }, 150);

    setTimeout(() => {
      clearInterval(checkStable);
      resolve({ stable: true, length: lastLength, timedOut: true });
    }, 5000);
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url) return;

  try {
    // Check if auto-capture is enabled
    const settings = await chrome.storage.local.get({ autoCapture: false });
    if (!settings.autoCapture) {
      return; // Skip auto-capture if disabled
    }

    const url = new URL(tab.url);
    const path = url.pathname;

    if (!URL_PATTERN.test(path)) {
      return;
    }

    if (capturedUrls.has(tab.url)) {
      console.log("[Ghost] Already captured:", tab.url);
      return;
    }

    console.log("[Ghost] ✓ Profile URL detected (AUTO):", tab.url);

    const stored = await chrome.storage.local.get({ scrapedData: {} });
    if (stored.scrapedData[tab.url]) {
      console.log("[Ghost] Already in storage, skipping:", tab.url);
      return;
    }

    chrome.action.setBadgeText({ text: "⏳" });
    chrome.action.setBadgeBackgroundColor({ color: "#ffaa00" });

    try {
      const stabilityResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: waitForContentStable,
        world: "ISOLATED",
      });
      console.log("[Ghost] Content stability:", stabilityResult[0]?.result);
    } catch (e) {
      console.log("[Ghost] Stability check skipped");
    }

    await new Promise((r) => setTimeout(r, 800));

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
    console.log("[Ghost] Auto-capture mode:", request.enabled ? "ON" : "OFF");
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
        profileId: profiles[url].profileId,
        fullName: profiles[url].fullName,
        captureMode: profiles[url].captureMode,
      }));

      sendResponse({
        count: urls.length,
        urls,
        summaries,
        sizeKB,
        totalRawHtml: urls.reduce(
          (acc, url) => acc + (profiles[url].rawHtmlSize || 0),
          0
        ),
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
  return captureTab(tab.id, tab.url, false);
}

async function captureTab(tabId, url, isAuto) {
  try {
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      return { success: false, error: "Cannot capture browser pages" };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: stealthExtractAndParse,
    });

    const data = results[0]?.result;
    if (!data || !data.identity?.fullName) {
      return { success: false, error: "Could not extract profile data" };
    }

    const stored = await chrome.storage.local.get({ scrapedData: {} });
    stored.scrapedData[data.url] = {
      profileId: data.profileId,
      extractedAt: data.extractedAt,
      captureMode: isAuto ? "auto" : "manual",

      fullName: data.identity.fullName,
      headline: data.identity.headline,
      pronouns: data.identity.pronouns,

      about: data.about,

      currentCompany: data.affiliations.currentCompany,
      educationSummary: data.affiliations.education,

      experience: data.experience,

      education: data.educationList,

      certifications: data.certifications,

      skills: data.skills,

      location: data.locationInfo.location,
      portfolioUrl: data.locationInfo.portfolioUrl,

      connections: data.network.connections,

      profileImage: data.profileImage,
      activities : data.activities,

      projects : data.projectsList,
      pageTitle: data.pageTitle,
      rawHtmlSize: data.rawHtmlSize,
    };
    await chrome.storage.local.set({ scrapedData: stored.scrapedData });

    const badgeText = isAuto ? "A✓" : "M✓";
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({
      color: isAuto ? "#ff9900" : "#00AA00",
    });
    setTimeout(() => updateBadgeCount(), 2500);

    const savedSize = JSON.stringify(stored.scrapedData[data.url]).length;
    console.log(
      `[Ghost] ${isAuto ? "🤖 AUTO" : "👆 MANUAL"} captured:`,
      data.profileId
    );
    console.log(
      `[Ghost] 📦 Raw HTML: ${
        data.rawHtmlSize
      } chars → Extracted: ${savedSize} chars (${Math.round(
        (savedSize / data.rawHtmlSize) * 100
      )}%)`
    );

    return {
      success: true,
      profileId: data.profileId,
      fullName: data.identity.fullName,
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
