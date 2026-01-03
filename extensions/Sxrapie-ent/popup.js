function updateStats() {
  chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
    if (response) {
      const sizeInfo = response.sizeKB ? ` (${response.sizeKB} KB)` : '';
      document.getElementById('itemCount').innerText = `📁 ${response.count} companies${sizeInfo}`;
      
      const urlList = document.getElementById('urlList');
      urlList.innerHTML = '';
      
      if (response.summaries && response.summaries.length > 0) {
        response.summaries.slice(-10).reverse().forEach(company => {
          const div = document.createElement('div');
          const icon = company.captureMode === 'auto' ? '🤖' : '👆';
          div.textContent = `${icon} ${company.name || company.companyId || 'Unknown'}`;
          div.title = company.url;
          div.style.cursor = 'pointer';
          div.onclick = () => chrome.tabs.create({ url: company.url });
          urlList.appendChild(div);
        });
        
        if (response.totalRawHtml > 0) {
          const compressionDiv = document.createElement('div');
          compressionDiv.style.cssText = 'margin-top:8px; font-size:10px; color:#7ee787; border-top:1px solid #30363d; padding-top:6px;';
          const rawMB = (response.totalRawHtml / 1024 / 1024).toFixed(2);
          compressionDiv.textContent = `💾 Compressed from ${rawMB} MB raw HTML`;
          urlList.appendChild(compressionDiv);
        }
      } else {
        urlList.innerHTML = '<div style="color:#484f58;">No captures yet...</div>';
      }
    }
  });
}

document.getElementById('captureBtn').addEventListener('click', async () => {
  const btn = document.getElementById('captureBtn');
  btn.innerText = '⏳ Capturing...';
  btn.disabled = true;
  
  chrome.runtime.sendMessage({ action: "capture" }, (response) => {
    if (response?.success) {
      btn.innerText = '✓ Captured!';
      btn.style.borderColor = '#00ff00';
      btn.style.color = '#00ff00';
      updateStats();
    } else {
      btn.innerText = '✗ ' + (response?.error || 'Failed');
      btn.style.borderColor = '#ff0000';
      btn.style.color = '#ff0000';
    }
    
    setTimeout(() => {
      btn.innerText = '👆 CAPTURE COMPANY';
      btn.style.borderColor = '#58a6ff';
      btn.style.color = '#58a6ff';
      btn.disabled = false;
    }, 2000);
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  chrome.storage.local.get({ scrapedData: {} }, (result) => {
    const data = result.scrapedData;
    const count = Object.keys(data).length;
    
    if (count === 0) {
      alert('No data to download!');
      return;
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    // Updated filename for companies
    downloadAnchorNode.setAttribute("download", `ghost_companies_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Delete all captured company data?')) {
    chrome.runtime.sendMessage({ action: "clearData" }, (response) => {
      if (response?.success) {
        updateStats();
        alert('All data cleared!');
      }
    });
  }
});

// Toggle auto/manual mode
const autoToggle = document.getElementById('autoToggle');
const modeLabel = document.getElementById('modeLabel');

function updateModeLabel(isAuto) {
  if (isAuto) {
    modeLabel.textContent = '🤖 AUTO';
    modeLabel.className = 'toggle-label auto';
  } else {
    modeLabel.textContent = '👆 MANUAL';
    modeLabel.className = 'toggle-label manual';
  }
}

// Load saved mode
chrome.storage.local.get({ autoCapture: false }, (result) => {
  autoToggle.checked = result.autoCapture;
  updateModeLabel(result.autoCapture);
});

// Save mode on toggle
autoToggle.addEventListener('change', () => {
  const isAuto = autoToggle.checked;
  chrome.storage.local.set({ autoCapture: isAuto });
  updateModeLabel(isAuto);
  
  // Notify background script
  chrome.runtime.sendMessage({ action: "setAutoMode", enabled: isAuto });
});

updateStats();
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "updateStats") updateStats();
});