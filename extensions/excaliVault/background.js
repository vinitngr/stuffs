console.log('ExcaliVault service worker loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('ExcaliVault installed/updated');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProjectCount') {
        const data = localStorage.getItem('excaliVault_projects');
        const projects = data ? JSON.parse(data) : [];
        sendResponse({ count: projects.length });
    }
});
