
const URL_PATTERN = /\/in\/[^\/]+\/?$/;

const capturedUrls = new Set();

function stealthExtractAndParse() {
  const html = document.documentElement.outerHTML;
  const url = window.location.href;
  const title = document.title;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
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
    return text.replace(/\s+/g, ' ').trim();
  };
  
  
  const fullName = getText('h1') || getText('.text-heading-xlarge') || getText('[data-anonymize="person-name"]');
  const headline = getText('.text-body-medium') || getText('[data-anonymize="headline"]');
  const pronouns = getText('span.v-align-middle') || getText('[aria-label*="pronouns"]');
  
  const currentCompanyBtn = doc.querySelector('button[aria-label^="Current company:"]');
  const currentCompany = currentCompanyBtn ? currentCompanyBtn.textContent.trim() : null;
  
  const educationBtn = doc.querySelector('button[aria-label^="Education:"]');
  const education = educationBtn ? educationBtn.textContent.trim() : null;
  
  const experienceItems = [];
  
  const expEntities = doc.querySelectorAll('[data-view-name="profile-component-entity"]');
  
  expEntities.forEach((entity, index) => {
    if (index >= 10) return;
    
    const companyLogoLink = entity.querySelector('a[data-field="experience_company_logo"]');
    if (!companyLogoLink) return;
    
    const titleEl = entity.querySelector('.t-bold span[aria-hidden="true"]');
    const jobTitle = titleEl ? cleanText(titleEl.textContent) : null;
    
    const companySpans = entity.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]');
    let company = null;
    let employmentType = null;
    
    if (companySpans.length > 0) {
      const companyText = cleanText(companySpans[0].textContent);
      if (companyText && companyText.includes('·')) {
        const parts = companyText.split('·').map(p => p.trim());
        company = parts[0];
        employmentType = parts[1];
      } else {
        company = companyText;
      }
    }
    
    const durationEl = entity.querySelector('.pvs-entity__caption-wrapper[aria-hidden="true"]');
    const duration = durationEl ? cleanText(durationEl.textContent) : null;
    
    const locationSpans = entity.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
    let jobLocation = null;
    locationSpans.forEach(span => {
      const text = cleanText(span.textContent);
      if (text && !text.includes('mos') && !text.includes('yrs') && !text.includes(' - ')) {
        jobLocation = text;
      }
    });
    
    const descEl = entity.querySelector('.inline-show-more-text span[aria-hidden="true"]');
    let description = descEl ? cleanText(descEl.textContent) : null;
    
    if (description && description.length > 500) {
      description = description.substring(0, 500) + '...';
    }
    
    const logoImg = entity.querySelector('img[alt*="logo"]');
    const companyLogo = logoImg ? logoImg.getAttribute('src') : null;
    
    const skillsEl = entity.querySelector('strong');
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
        skills
      });
    }
  });
  
  let aboutText = null;
  
  const allInlineTexts = doc.querySelectorAll('.inline-show-more-text');
  for (const container of allInlineTexts) {
    const parentEntity = container.closest('[data-view-name="profile-component-entity"]');
    const parentListItem = container.closest('li.artdeco-list__item');
    if (parentEntity || parentListItem) continue;
    
    const textSpan = container.querySelector('span[aria-hidden="true"]');
    if (textSpan && !textSpan.classList.contains('visually-hidden')) {
      let htmlContent = textSpan.innerHTML;
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
      htmlContent = htmlContent.replace(/<!--.*?-->/g, '');
      const temp = document.createElement('div');
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent.trim();
      aboutText = aboutText.replace(/…see more$/i, '').trim();
      
      if (aboutText && aboutText.length > 20) {
        break;
      }
    }
  }
  
  if (!aboutText) {
    const aboutSection = doc.querySelector('.display-flex.ph5.pv3 span[aria-hidden="true"]');
    if (aboutSection && !aboutSection.classList.contains('visually-hidden')) {
      let htmlContent = aboutSection.innerHTML;
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<!--.*?-->/g, '');
      const temp = document.createElement('div');
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent.trim().replace(/…see more$/i, '').trim();
    }
  }
  
  if (!aboutText) {
    const suggestionTarget = doc.querySelector('[data-generated-suggestion-target] span[aria-hidden="true"]');
    if (suggestionTarget && !suggestionTarget.classList.contains('visually-hidden')) {
      let htmlContent = suggestionTarget.innerHTML;
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<!--.*?-->/g, '');
      const temp = document.createElement('div');
      temp.innerHTML = htmlContent;
      aboutText = temp.textContent.trim().replace(/…see more$/i, '').trim();
    }
  }
  
  if (!aboutText) {
    const aboutById = doc.querySelector('#about ~ div span[aria-hidden="true"], section.about span[aria-hidden="true"]');
    if (aboutById) {
      aboutText = aboutById.textContent.trim().replace(/…see more$/i, '').trim();
    }
  }
  
  if (aboutText && aboutText.length > 1500) {
    aboutText = aboutText.substring(0, 1500) + '...';
  }
  
  const educationItems = [];
  
  const allListItems = doc.querySelectorAll('li.artdeco-list__item');
  
  allListItems.forEach((li) => {
    const eduLink = li.querySelector('a[href*="EDUCATION"]');
    if (!eduLink) return;
    
    if (educationItems.length >= 10) return;
    
    const schoolEl = li.querySelector('.t-bold span[aria-hidden="true"]');
    const school = schoolEl ? cleanText(schoolEl.textContent) : null;
    
    const degreeEl = li.querySelector('.t-14.t-normal span[aria-hidden="true"]');
    const degree = degreeEl ? cleanText(degreeEl.textContent) : null;
    
    const datesEl = li.querySelector('.t-black--light span[aria-hidden="true"], .pvs-entity__caption-wrapper[aria-hidden="true"]');
    const dates = datesEl ? cleanText(datesEl.textContent) : null;
    
    let activities = null;
    const subComponents = li.querySelector('.pvs-entity__sub-components');
    if (subComponents) {
      const activityText = subComponents.textContent;
      const activityMatch = activityText.match(/Activities and societies:\s*(.+?)(?:Skills:|$)/s);
      if (activityMatch) {
        activities = cleanText(activityMatch[1]);
      } else {
        const descSpan = subComponents.querySelector('.inline-show-more-text span[aria-hidden="true"]');
        if (descSpan) {
          activities = cleanText(descSpan.textContent);
        }
      }
    }
    
    const logoImg = li.querySelector('img[alt*="logo"]');
    const schoolLogo = logoImg ? logoImg.getAttribute('src') : null;
    
    if (school) {
      educationItems.push({
        school,
        degree,
        dates,
        activities,
        schoolLogo
      });
    }
  });
  
  const certifications = [];
  
  allListItems.forEach((li) => {
    const certLink = li.querySelector('a[href*="LICENSE"], a[href*="CERTIFICATION"]');
    const showCredentialBtn = li.querySelector('a[href*="credential"], button[aria-label*="credential"]');
    
    const hasCredentialId = li.textContent.includes('Credential ID');
    const hasIssued = li.textContent.includes('Issued');
    
    if (!certLink && !showCredentialBtn && !hasCredentialId && !hasIssued) return;
    
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
    
    const credUrlEl = li.querySelector('a[href*="credential"]') || 
                      li.querySelector('a[aria-label*="credential"]') ||
                      li.querySelector('a[href*="credly"]') ||
                      li.querySelector('a[href*="coursera"]') ||
                      li.querySelector('a[href*="verify"]');
    const credentialUrl = credUrlEl ? credUrlEl.getAttribute('href') : null;
    
    let associatedSkills = null;
    const skillsEl = li.querySelector('.hoverable-link-text strong, .hoverable-link-text');
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
        associatedSkills
      });
    }
  });
  
  const skillsList = [];
  
  allListItems.forEach((li) => {
    const skillLink = li.querySelector('a[href*="SKILL"], a[href*="skill-associations"]');
    
    if (!skillLink) return;
    
    if (li.querySelector('a[href*="EDUCATION"], a[href*="POSITION"], a[href*="LICENSE"]')) return;
    
    if (skillsList.length >= 30) return;
    
    const skillNameEl = li.querySelector('.t-bold span[aria-hidden="true"]');
    const skillName = skillNameEl ? cleanText(skillNameEl.textContent) : null;
    
    let applicationContext = null;
    const subComponents = li.querySelector('.pvs-entity__sub-components');
    if (subComponents) {
      const contextSpan = subComponents.querySelector('span[aria-hidden="true"]');
      if (contextSpan && !contextSpan.classList.contains('visually-hidden')) {
        applicationContext = cleanText(contextSpan.textContent);
        applicationContext = applicationContext.replace(/…see more$/i, '').trim();
      }
    }
    
    if (skillName) {
      skillsList.push({
        skillName,
        applicationContext
      });
    }
  });
  
  const location = getText('.text-body-small.inline.t-black--light.break-words') || 
                   getText('[data-anonymize="location"]') ||
                   getText('.pv-top-card--list-bullet .text-body-small');
  
  const portfolioLink = getAttr('a[target="_blank"][href*="://"]', 'href');
  
  const connectionsLink = doc.querySelector('a[href*="/connections/"]');
  const connectionsText = connectionsLink ? connectionsLink.textContent.trim() : null;
  const connections = connectionsText ? connectionsText.match(/\d+/)?.[0] : null;
  
  const profileImg = getAttr('.pv-top-card__photo-wrapper img', 'src') ||
                     getAttr('img[data-anonymize="headshot-photo"]', 'src') ||
                     getAttr('.profile-photo-edit__preview', 'src') ||
                     getAttr('img[alt*="profile"]', 'src');
  
  const profileIdMatch = url.match(/\/in\/([^\/\?]+)/);
  const profileId = profileIdMatch ? profileIdMatch[1] : null;
  
  return {
    url,
    profileId,
    extractedAt: new Date().toISOString(),
    
    identity: {
      fullName,
      headline,
      pronouns
    },
    
    about: aboutText,
    
    affiliations: {
      currentCompany,
      education
    },
    
    experience: experienceItems,
    
    educationList: educationItems,
    
    certifications: certifications,
    
    skills: skillsList,
    
    locationInfo: {
      location,
      portfolioUrl: portfolioLink
    },
    
    network: {
      connections: connections ? parseInt(connections) : null
    },
    
    profileImage: profileImg,
    
    pageTitle: title,
    rawHtmlSize: html.length
  };
}

function waitForContentStable() {
  return new Promise((resolve) => {
    let lastLength = 0;
    let stableCount = 0;
    
    const checkStable = setInterval(() => {
      const currentLength = document.body.innerHTML.length;
      
      if (currentLength === lastLength && currentLength > 1000) {
        stableCount++;
        if (stableCount >= 8) {
          clearInterval(checkStable);
          resolve({ stable: true, length: currentLength });
        }
      } else {
        stableCount = 0;
        lastLength = currentLength;
      }
    }, 250);
    
    setTimeout(() => {
      clearInterval(checkStable);
      resolve({ stable: true, length: lastLength, timedOut: true });
    }, 20000);
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;
  
  try {
    const url = new URL(tab.url);
    const path = url.pathname;
    
    if (!URL_PATTERN.test(path)) {
    }
    
    if (capturedUrls.has(tab.url)) {
      console.log('[Ghost] Already captured:', tab.url);
      return;
    }
    
    console.log('[Ghost] ✓ Profile URL detected:', tab.url);
    
    chrome.action.setBadgeText({ text: '⏳' });
    chrome.action.setBadgeBackgroundColor({ color: '#ffaa00' });
    
    try {
      const stabilityResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: waitForContentStable,
        world: 'ISOLATED'
      });
      console.log('[Ghost] Content stability:', stabilityResult[0]?.result);
    } catch (e) {
      console.log('[Ghost] Stability check skipped');
    }
    
    await new Promise(r => setTimeout(r, 3000));
    
    await captureTab(tabId, tab.url, true);
    capturedUrls.add(tab.url);
    
  } catch (err) {
    console.error('[Ghost] Auto-capture error:', err);
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
  if (request.action === "getStats") {
    chrome.storage.local.get({ scrapedData: {} }, (result) => {
      const profiles = result.scrapedData;
      const urls = Object.keys(profiles);
      
      const dataStr = JSON.stringify(profiles);
      const sizeKB = (dataStr.length / 1024).toFixed(1);
      
      const summaries = urls.map(url => ({
        url,
        profileId: profiles[url].profileId,
        fullName: profiles[url].fullName,
        captureMode: profiles[url].captureMode
      }));
      
      sendResponse({ 
        count: urls.length, 
        urls, 
        summaries,
        sizeKB,
        totalRawHtml: urls.reduce((acc, url) => acc + (profiles[url].rawHtmlSize || 0), 0)
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
  if (!tab?.id) return { success: false, error: 'No active tab' };
  return captureTab(tab.id, tab.url, false);
}

async function captureTab(tabId, url, isAuto) {
  try {
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return { success: false, error: 'Cannot capture browser pages' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: stealthExtractAndParse,
    });

    const data = results[0]?.result;
    if (!data || !data.identity?.fullName) {
      return { success: false, error: 'Could not extract profile data' };
    }

    const stored = await chrome.storage.local.get({ scrapedData: {} });
    stored.scrapedData[data.url] = {
      profileId: data.profileId,
      extractedAt: data.extractedAt,
      captureMode: isAuto ? 'auto' : 'manual',
      
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
      
      pageTitle: data.pageTitle,
      rawHtmlSize: data.rawHtmlSize
    };
    await chrome.storage.local.set({ scrapedData: stored.scrapedData });

    const badgeText = isAuto ? 'A✓' : 'M✓';
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: isAuto ? '#ff9900' : '#00AA00' });
    setTimeout(() => updateBadgeCount(), 2500);

    const savedSize = JSON.stringify(stored.scrapedData[data.url]).length;
    console.log(`[Ghost] ${isAuto ? '🤖 AUTO' : '👆 MANUAL'} captured:`, data.profileId);
    console.log(`[Ghost] 📦 Raw HTML: ${data.rawHtmlSize} chars → Extracted: ${savedSize} chars (${Math.round(savedSize/data.rawHtmlSize*100)}%)`);
    
    return { 
      success: true, 
      profileId: data.profileId,
      fullName: data.identity.fullName,
      savedSize,
      compression: `${Math.round(savedSize/data.rawHtmlSize*100)}%`,
      mode: isAuto ? 'auto' : 'manual'
    };
    
  } catch (err) {
    console.error('[Ghost] Capture failed:', err);
    chrome.action.setBadgeText({ text: '✗' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    setTimeout(() => updateBadgeCount(), 2000);
    return { success: false, error: err.message };
  }
}

async function updateBadgeCount() {
  const result = await chrome.storage.local.get({ scrapedData: {} });
  const count = Object.keys(result.scrapedData).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#666' });
}

chrome.runtime.onStartup.addListener(updateBadgeCount);
chrome.runtime.onInstalled.addListener(updateBadgeCount);
updateBadgeCount();
