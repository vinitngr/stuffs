// Background Service Worker - Session-only state management
// All data is stored in-memory and lost when extension reloads or browser closes

// Session-only clipboard slots storage
let clipboardSlots = [
  { id: 0, content: '', locked: false, source: '' },
  { id: 1, content: '', locked: false, source: '' },
  { id: 2, content: '', locked: false, source: '' }
];

let slotIdCounter = 3;

// Initialize or reset state
function initializeState() {
  clipboardSlots = [
    { id: 0, content: '', locked: false, source: '' },
    { id: 1, content: '', locked: false, source: '' },
    { id: 2, content: '', locked: false, source: '' }
  ];
  slotIdCounter = 3;
}

// Message handler for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_SLOTS':
      sendResponse({ slots: clipboardSlots });
      break;
      
    case 'ADD_SLOT':
      const newSlot = { id: slotIdCounter++, content: '', locked: false, source: '' };
      clipboardSlots.push(newSlot);
      sendResponse({ success: true, slots: clipboardSlots });
      break;
      
    case 'UPDATE_SLOT':
      const { slotId, content, locked, source } = request;
      const slot = clipboardSlots.find(s => s.id === slotId);
      if (slot) {
        if (content !== undefined) slot.content = content;
        if (locked !== undefined) slot.locked = locked;
        if (source !== undefined) slot.source = source;
        sendResponse({ success: true, slot });
      } else {
        sendResponse({ success: false, error: 'Slot not found' });
      }
      break;
      
    case 'TOGGLE_LOCK':
      const targetSlot = clipboardSlots.find(s => s.id === request.slotId);
      if (targetSlot) {
        targetSlot.locked = !targetSlot.locked;
        sendResponse({ success: true, locked: targetSlot.locked });
      } else {
        sendResponse({ success: false, error: 'Slot not found' });
      }
      break;
      
    case 'GET_SLOT_CONTENT':
      const contentSlot = clipboardSlots.find(s => s.id === request.slotId);
      if (contentSlot) {
        sendResponse({ success: true, content: contentSlot.content, locked: contentSlot.locked });
      } else {
        sendResponse({ success: false, error: 'Slot not found' });
      }
      break;
      
    case 'RESET_STATE':
      initializeState();
      sendResponse({ success: true, slots: clipboardSlots });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

// Log when service worker starts (session begins)
console.log('Copy0: Service worker started - clipboard session initialized');

// Service worker can be terminated by Chrome, but session data persists
// until browser close or extension reload
