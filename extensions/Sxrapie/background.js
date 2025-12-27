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

  const fullName =
    getText("h1") ||
    getText(".text-heading-xlarge") ||
    getText('[data-anonymize="person-name"]');
  const headline =
    getText(".text-body-medium") || getText('[data-anonymize="headline"]');
  const pronouns =
    getText("span.v-align-middle") || getText('[aria-label*="pronouns"]');

  const currentCompanyBtn = doc.querySelector(
    'button[aria-label^="Current company:"]'
  );
  const currentCompany = currentCompanyBtn
    ? currentCompanyBtn.textContent.trim()
    : null;

  const educationBtn = doc.querySelector('button[aria-label^="Education:"]');
  const education = educationBtn ? educationBtn.textContent.trim() : null;

  const experienceItems = [];

  const expEntities = doc.querySelectorAll(
    '[data-view-name="profile-component-entity"]'
  );

  expEntities.forEach((entity, index) => {
    if (index >= 10) return;

    const companyLogoLink = entity.querySelector(
      'a[data-field="experience_company_logo"]'
    );
    if (!companyLogoLink) return;

    const titleEl = entity.querySelector('.t-bold span[aria-hidden="true"]');
    const jobTitle = titleEl ? cleanText(titleEl.textContent) : null;

    const companySpans = entity.querySelectorAll(
      '.t-14.t-normal span[aria-hidden="true"]'
    );
    let company = null;
    let employmentType = null;

    if (companySpans.length > 0) {
      const companyText = cleanText(companySpans[0].textContent);
      if (companyText && companyText.includes("·")) {
        const parts = companyText.split("·").map((p) => p.trim());
        company = parts[0];
        employmentType = parts[1];
      } else {
        company = companyText;
      }
    }

    const durationEl = entity.querySelector(
      '.pvs-entity__caption-wrapper[aria-hidden="true"]'
    );
    const duration = durationEl ? cleanText(durationEl.textContent) : null;

    const locationSpans = entity.querySelectorAll(
      '.t-14.t-normal.t-black--light span[aria-hidden="true"]'
    );
    let jobLocation = null;
    locationSpans.forEach((span) => {
      const text = cleanText(span.textContent);
      if (
        text &&
        !text.includes("mos") &&
        !text.includes("yrs") &&
        !text.includes(" - ")
      ) {
        jobLocation = text;
      }
    });

    const descEl = entity.querySelector(
      '.inline-show-more-text span[aria-hidden="true"]'
    );
    let description = descEl ? cleanText(descEl.textContent) : null;

    if (description && description.length > 500) {
      description = description.substring(0, 500) + "...";
    }

    const logoImg = entity.querySelector('img[alt*="logo"]');
    const companyLogo = logoImg ? logoImg.getAttribute("src") : null;

    const skillsEl = entity.querySelector("strong");
    const skills = skillsEl ? cleanText(skillsEl.textContent) : null;

    if (jobTitle) {
      experienceItems.push({
        title: jobTitle,
        company,
        employmentType,
        duration,
        location: jobLocation,
        description,
        companyLogo,
        skills,
      });
    }
  });

  let aboutText = null;

  const allInlineTexts = doc.querySelectorAll(".inline-show-more-text");
  for (const container of allInlineTexts) {
    const parentEntity = container.closest(
      '[data-view-name="profile-component-entity"]'
    );
    const parentListItem = container.closest("li.artdeco-list__item");
    if (parentEntity || parentListItem) continue;

    const textSpan = container.querySelector('span[aria-hidden="true"]');
    if (textSpan && !textSpan.classList.contains("visually-hidden")) {
      let htmlContent = textSpan.innerHTML;
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, "\n");
      htmlContent = htmlContent.replace(/<!--.*?-->/g, "");
      const temp = document.createElement("div");
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent.trim();
      aboutText = aboutText.replace(/…see more$/i, "").trim();

      if (aboutText && aboutText.length > 20) {
        break;
      }
    }
  }

  if (!aboutText) {
    const aboutSection = doc.querySelector(
      '.display-flex.ph5.pv3 span[aria-hidden="true"]'
    );
    if (aboutSection && !aboutSection.classList.contains("visually-hidden")) {
      let htmlContent = aboutSection.innerHTML;
      htmlContent = htmlContent
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<!--.*?-->/g, "");
      const temp = document.createElement("div");
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent
        .trim()
        .replace(/…see more$/i, "")
        .trim();
    }
  }

  if (!aboutText) {
    const suggestionTarget = doc.querySelector(
      '[data-generated-suggestion-target] span[aria-hidden="true"]'
    );
    if (
      suggestionTarget &&
      !suggestionTarget.classList.contains("visually-hidden")
    ) {
      let htmlContent = suggestionTarget.innerHTML;
      htmlContent = htmlContent
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<!--.*?-->/g, "");
      const temp = document.createElement("div");
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent
        .trim()
        .replace(/…see more$/i, "")
        .trim();
    }
  }

  if (!aboutText) {
    const aboutById = doc.querySelector(
      '#about ~ div span[aria-hidden="true"], section.about span[aria-hidden="true"]'
    );
    if (aboutById) {
      aboutText = aboutById.textContent
        .trim()
        .replace(/…see more$/i, "")
        .trim();
    }
  }

  if (aboutText && aboutText.length > 1500) {
    aboutText = aboutText.substring(0, 1500) + "...";
  }

  // Extract education items from the Education section
  const educationItems = [];
  
  // Find education section by looking for #education anchor or section with Education header
  let educationSection = null;
  
  // Method 1: Find by #education id
  const eduAnchor = doc.querySelector('#education');
  if (eduAnchor) {
    educationSection = eduAnchor.closest('section');
  }
  
  // Method 2: Find section by header text
  if (!educationSection) {
    const allSections = doc.querySelectorAll('section');
    for (let i = 0; i < allSections.length; i++) {
      const section = allSections[i];
      const headerEl = section.querySelector('h2 span[aria-hidden="true"], div[id="education"]');
      if (headerEl) {
        const headerText = headerEl.textContent.toLowerCase().trim();
        if (headerText === 'education') {
          educationSection = section;
          break;
        }
      }
      // Also check if section contains #education
      if (section.querySelector('#education')) {
        educationSection = section;
        break;
      }
    }
  }

  // Method 3: Find by data-section attribute
  if (!educationSection) {
    educationSection = doc.querySelector('section[data-section="educationsDetails"]');
  }

  // Extract education items from the found section
  if (educationSection) {
    const eduListItems = educationSection.querySelectorAll("li.artdeco-list__item");
    
    for (let i = 0; i < eduListItems.length; i++) {
      if (educationItems.length >= 10) break;
      
      const li = eduListItems[i];

      // School Name - required field (in .t-bold)
      const schoolEl = li.querySelector('.t-bold span[aria-hidden="true"]');
      const school = schoolEl ? cleanText(schoolEl.textContent) : null;

      if (!school) continue;

      // Degree - use :not(.t-black--light) to avoid picking up dates
      const degreeEl = li.querySelector(
        '.t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]'
      );
      const degree = degreeEl ? cleanText(degreeEl.textContent) : null;

      // Dates - in .t-black--light or .pvs-entity__caption-wrapper
      let dates = null;
      const datesEl = li.querySelector('.t-black--light span[aria-hidden="true"]');
      if (datesEl) {
        dates = cleanText(datesEl.textContent);
      } else {
        const captionEl = li.querySelector('.pvs-entity__caption-wrapper[aria-hidden="true"]');
        if (captionEl) {
          dates = cleanText(captionEl.textContent);
        }
      }

      // Grade / Details
      let grade = null;
      let activities = null;
      const detailsEl = li.querySelector('.inline-show-more-text span[aria-hidden="true"]');
      if (detailsEl) {
        const detailsText = cleanText(detailsEl.textContent);
        if (detailsText) {
          if (detailsText.toLowerCase().startsWith('grade:')) {
            grade = detailsText;
          } else if (detailsText.toLowerCase().includes('activities and societies:')) {
            const match = detailsText.match(/activities and societies:\s*(.+)/i);
            activities = match ? match[1].trim() : detailsText;
          } else {
            activities = detailsText;
          }
        }
      }

      // Skills
      const skillsEl = li.querySelector('.hoverable-link-text strong');
      const skills = skillsEl ? cleanText(skillsEl.textContent) : null;

      // School logo
      const logoImg = li.querySelector('img[alt*="logo"]');
      const schoolLogo = logoImg ? logoImg.getAttribute("src") : null;

      educationItems.push({
        school,
        degree,
        dates,
        grade,
        activities,
        skills,
        schoolLogo,
      });
    }
  }

  console.log("[Ghost] Education section found:", !!educationSection, "Items:", educationItems.length);


  // --- ACTIVITY SECTION LOGIC ---
  const activityData = {
    followers: null,
    posts: []
  };

  // 1. Find the Activity Section
  // We look for the header that contains "Activity"
  let activitySection = null;
  const allSections = doc.querySelectorAll('section');
  
  for (const section of allSections) {
    const header = section.querySelector('h2 span[aria-hidden="true"]');
    if (header && header.textContent.trim() === "Activity") {
      activitySection = section;
      break;
    }
  }

  if (activitySection) {
    // 2. Extract Follower Count (Global for section)
    const followerEl = activitySection.querySelector('.pvs-header__optional-link span[aria-hidden="true"]');
    activityData.followers = followerEl ? cleanText(followerEl.textContent) : null;

    // 3. Extract Posts (Carousel Items)
    // The posts are inside a carousel slider
    const slides = activitySection.querySelectorAll('.artdeco-carousel__item');

    slides.forEach((slide) => {
      // Skip empty/hidden slides (carousel items often load lazily)
      if (!slide.querySelector('.feed-shared-update-v2')) return;

      // A. Post Text
      const textEl = slide.querySelector('.feed-shared-update-v2__description .update-components-text');
      // If there is a "celebration" headline (like "Starting a New Position"), grab that too
      const headlineEl = slide.querySelector('.update-components-celebration__headline');
      
      let postText = textEl ? cleanText(textEl.textContent) : "";
      if (headlineEl) {
        postText = `[${cleanText(headlineEl.textContent)}] ${postText}`;
      }

      // B. Post Image (if any)
      const imgEl = slide.querySelector('.feed-shared-celebration-image__image, .update-components-image__image');
      const postImage = imgEl ? imgEl.getAttribute('src') : null;

      // C. Engagement Stats (Likes/Comments)
      const reactionsEl = slide.querySelector('.social-details-social-counts__reactions-count');
      const commentsEl = slide.querySelector('.social-details-social-counts__comments span[aria-hidden="true"]');
      
      const reactionCount = reactionsEl ? cleanText(reactionsEl.textContent) : "0";
      const commentCount = commentsEl ? cleanText(commentsEl.textContent) : "0 comments";

      // D. Time Posted (e.g., "1mo")
      const timeEl = slide.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]');
      let timePosted = null;
      if (timeEl) {
        // usually format is "1mo •" -> split by bullet
        timePosted = cleanText(timeEl.textContent).split('•')[0].trim();
      }

      // E. Post URL
      // The link is usually on the text or the "tap-target" class
      const linkEl = slide.querySelector('a.tap-target, a.app-aware-link');
      const postUrl = linkEl ? linkEl.getAttribute('href') : null;

      activityData.posts.push({
        text: postText,
        time: timePosted,
        reactions: reactionCount,
        comments: commentCount,
        imageUrl: postImage,
        postUrl: postUrl
      });
    });
  }

  console.log("Activity Data:", activityData);
  // Extract Project items
  const projectItems = [];

  // Find Project section
  let projectSection = null;

  // Method 1: Find by #projects id
  const projectAnchor = doc.querySelector('#projects');
  if (projectAnchor) {
    projectSection = projectAnchor.closest('section');
  }

  // Method 2: Find section by header text "Projects"
  if (!projectSection) {
    const allSections = doc.querySelectorAll('section');
    for (let i = 0; i < allSections.length; i++) {
      const section = allSections[i];
      const headerEl = section.querySelector('h2 span[aria-hidden="true"], div[id="projects"]');
      if (headerEl) {
        const headerText = headerEl.textContent.toLowerCase().trim();
        // Check for "projects" or "projects" inside the text
        if (headerText.includes('projects')) {
          projectSection = section;
          break;
        }
      }
      if (section.querySelector('#projects')) {
        projectSection = section;
        break;
      }
    }
  }

  // Extract items from the found section
  if (projectSection) {
    // Only select the immediate list items to avoid nested chaos
    const projectListItems = projectSection.querySelectorAll("li.artdeco-list__item");

    for (let i = 0; i < projectListItems.length; i++) {
      if (projectItems.length >= 10) break;

      const li = projectListItems[i];

      // 1. Project Title (in .t-bold)
      const titleEl = li.querySelector('.t-bold span[aria-hidden="true"]');
      const title = titleEl ? cleanText(titleEl.textContent) : null;

      if (!title) continue;

      // 2. Dates (Sometimes projects have dates, sometimes not)
      const datesEl = li.querySelector('.t-black--light span[aria-hidden="true"]');
      const dates = datesEl ? cleanText(datesEl.textContent) : null;

      // 3. Description (The main text body)
      const descEl = li.querySelector('.inline-show-more-text span[aria-hidden="true"]');
      let description = descEl ? cleanText(descEl.textContent) : null;

      // 4. Skills (Inside the hoverable link strong tag)
      const skillsEl = li.querySelector('.hoverable-link-text strong');
      const skills = skillsEl ? cleanText(skillsEl.textContent) : null;

      // 5. Project Link / URL (Specific to Projects)
      // Looking for the anchor tag that wraps the thumbnail image or icon
      let projectUrl = null;
      
      // We look for an anchor that contains the pvs-thumbnail class
      const linkContainer = li.querySelector('a [class*="pvs-thumbnail"]');
      if (linkContainer) {
          // Go up to the parent <a> tag
          const parentLink = linkContainer.closest('a');
          if (parentLink) {
              projectUrl = parentLink.getAttribute('href');
          }
      }

      // If no thumbnail link, check for standard link button (less common in this view but possible)
      if (!projectUrl) {
          const buttonLink = li.querySelector('a.artdeco-button');
          if (buttonLink) projectUrl = buttonLink.getAttribute('href');
      }

      projectItems.push({
        title,
        dates,
        description,
        skills,
        projectUrl
      });
    }
  }
  
  // Console log to test
  console.log("Projects Found:", projectItems);


  const certifications = [];
  const certListItems = doc.querySelectorAll("li.artdeco-list__item");

  certListItems.forEach((li) => {
    const certLink = li.querySelector(
      'a[href*="LICENSE"], a[href*="CERTIFICATION"]'
    );
    const showCredentialBtn = li.querySelector(
      'a[href*="credential"], button[aria-label*="credential"]'
    );

    const hasCredentialId = li.textContent.includes("Credential ID");
    const hasIssued = li.textContent.includes("Issued");

    if (!certLink && !showCredentialBtn && !hasCredentialId && !hasIssued)
      return;

    if (li.querySelector('a[href*="EDUCATION"]')) return;

    if (certifications.length >= 15) return;

    const nameEl = li.querySelector('.t-bold span[aria-hidden="true"]');
    const name = nameEl ? cleanText(nameEl.textContent) : null;

    const orgEl = li.querySelector('.t-14.t-normal span[aria-hidden="true"]');
    const issuingOrg = orgEl ? cleanText(orgEl.textContent) : null;

    const dateEl = li.querySelector('.t-black--light span[aria-hidden="true"]');
    let issueDate = dateEl ? cleanText(dateEl.textContent) : null;

    let credentialId = null;
    const fullText = li.textContent;
    const credMatch = fullText.match(/Credential ID\s*([A-Za-z0-9\-_]+)/);
    if (credMatch) {
      credentialId = credMatch[1];
    }

    const credUrlEl =
      li.querySelector('a[href*="credential"]') ||
      li.querySelector('a[aria-label*="credential"]') ||
      li.querySelector('a[href*="credly"]') ||
      li.querySelector('a[href*="coursera"]') ||
      li.querySelector('a[href*="verify"]');
    const credentialUrl = credUrlEl ? credUrlEl.getAttribute("href") : null;

    let associatedSkills = null;
    const skillsEl = li.querySelector(
      ".hoverable-link-text strong, .hoverable-link-text"
    );
    if (skillsEl) {
      associatedSkills = cleanText(skillsEl.textContent);
    }

    if (name) {
      certifications.push({
        name,
        issuingOrg,
        issueDate,
        credentialId,
        credentialUrl,
        associatedSkills,
      });
    }
  });

  const skillsList = [];
  const skillsListItems = doc.querySelectorAll("li.artdeco-list__item");

  skillsListItems.forEach((li) => {
    const skillLink = li.querySelector(
      'a[href*="SKILL"], a[href*="skill-associations"]'
    );

    if (!skillLink) return;

    if (
      li.querySelector(
        'a[href*="EDUCATION"], a[href*="POSITION"], a[href*="LICENSE"]'
      )
    )
      return;

    if (skillsList.length >= 30) return;

    const skillNameEl = li.querySelector('.t-bold span[aria-hidden="true"]');
    const skillName = skillNameEl ? cleanText(skillNameEl.textContent) : null;

    let applicationContext = null;
    const subComponents = li.querySelector(".pvs-entity__sub-components");
    if (subComponents) {
      const contextSpan = subComponents.querySelector(
        'span[aria-hidden="true"]'
      );
      if (contextSpan && !contextSpan.classList.contains("visually-hidden")) {
        applicationContext = cleanText(contextSpan.textContent);
        applicationContext = applicationContext
          .replace(/…see more$/i, "")
          .trim();
      }
    }

    if (skillName) {
      skillsList.push({
        skillName,
        applicationContext,
      });
    }
  });

  const location =
    getText(".text-body-small.inline.t-black--light.break-words") ||
    getText('[data-anonymize="location"]') ||
    getText(".pv-top-card--list-bullet .text-body-small");

  const portfolioLink = getAttr('a[target="_blank"][href*="://"]', "href");

  const connectionsLink = doc.querySelector('a[href*="/connections/"]');
  const connectionsText = connectionsLink
    ? connectionsLink.textContent.trim()
    : null;
  const connections = connectionsText
    ? connectionsText.match(/\d+/)?.[0]
    : null;

  const profileImg =
    getAttr(".pv-top-card__photo-wrapper img", "src") ||
    getAttr('img[data-anonymize="headshot-photo"]', "src") ||
    getAttr(".profile-photo-edit__preview", "src") ||
    getAttr('img[alt*="profile"]', "src");

  const profileIdMatch = url.match(/\/in\/([^\/\?]+)/);
  const profileId = profileIdMatch ? profileIdMatch[1] : null;

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
