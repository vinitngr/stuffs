document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiKey', 'customPrompt', 'autoMode'], (result) => {
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
    if (result.customPrompt) document.getElementById('customPrompt').value = result.customPrompt;
    if (result.autoMode) document.getElementById('autoMode').checked = result.autoMode;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const customPrompt = document.getElementById('customPrompt').value;
    const autoMode = document.getElementById('autoMode').checked;

    chrome.storage.local.set({ apiKey, customPrompt, autoMode }, () => {
      const btn = document.getElementById('saveBtn');
      btn.innerText = "Saved!";
      setTimeout(() => btn.innerText = "Save Settings", 1500);
    });
  });
});