// Content Script - Keyboard detection and UI injection
(function() {
  'use strict';

  // State management
  let ctrlCPressed = false;
  let ctrlVPressed = false;
  let longPressTimer = null;
  let isPopupActive = false;
  let currentMode = null; // 'copy' or 'paste'
  let selectedSlotIndex = 0;
  let clipboardSlots = [];
  let longPressTriggered = false; // Track if long-press was triggered
  
  const LONG_PRESS_DELAY = 300; // milliseconds

  // UI Elements
  let popupContainer = null;
  let previewContainer = null;

  // Initialize
  function init() {
    loadSlots();
    attachKeyboardListeners();
  }

  // Load slots from background
  function loadSlots() {
    try {
      chrome.runtime.sendMessage({ action: 'GET_SLOTS' }, (response) => {
        if (response && response.slots) {
          clipboardSlots = response.slots;
        }
      });
    } catch (err) {
      console.log('Copy0: Extension context invalidated');
    }
  }

  // Keyboard event listeners
  function attachKeyboardListeners() {
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
  }

  function handleKeyDown(e) {
    // Detect Ctrl+C
    if (e.ctrlKey && e.key === 'c' && !ctrlCPressed) {
      ctrlCPressed = true;
      longPressTriggered = false;
      
      // Start long-press timer
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        e.preventDefault();
        e.stopPropagation();
        openPopup('copy');
      }, LONG_PRESS_DELAY);
    }
    
    // Detect Ctrl+V - PREVENT IMMEDIATELY to block native paste
    if (e.ctrlKey && e.key === 'v' && !ctrlVPressed) {
      ctrlVPressed = true;
      longPressTriggered = false;
      // Prevent default immediately to block native paste
      e.preventDefault();
      e.stopPropagation();
      
      // Start long-press timer
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        openPopup('paste');
      }, LONG_PRESS_DELAY);
    }

    // Handle navigation when popup is active
    if (isPopupActive) {
      e.preventDefault();
      e.stopPropagation();
      handlePopupNavigation(e);
    }
  }

  function handleKeyUp(e) {
    // Ctrl+C released
    if (!e.ctrlKey && ctrlCPressed) {
      ctrlCPressed = false;
      
      // If long-press was triggered, handle copy action
      if (longPressTriggered && isPopupActive && currentMode === 'copy') {
        e.preventDefault();
        e.stopPropagation();
        handleCopyAction();
      }
      
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTriggered = false;
    }
    
    // Ctrl+V released
    if (!e.ctrlKey && ctrlVPressed) {
      ctrlVPressed = false;
      
      // If long-press was triggered, handle paste action from popup
      if (longPressTriggered && isPopupActive && currentMode === 'paste') {
        e.preventDefault();
        e.stopPropagation();
        handlePasteAction();
      }
      // If it was a quick press (not long-press), do native paste behavior
      else if (!longPressTriggered) {
        // Allow normal paste behavior
        document.execCommand('paste');
      }
      
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTriggered = false;
    }
  }

  function handlePopupNavigation(e) {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        navigateUp();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        navigateDown();
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        lockSlot();
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        unlockSlot();
        break;
        
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closePopup();
        break;
    }
  }

  // Navigation functions
  function navigateUp() {
    if (selectedSlotIndex > 0) {
      selectedSlotIndex--;
      updatePopupUI();
      scrollToSelectedSlot();
    }
  }

  function navigateDown() {
    // Check if we're on the "+ Add slot" option
    if (selectedSlotIndex === clipboardSlots.length) {
      // Add new slot
      try {
        chrome.runtime.sendMessage({ action: 'ADD_SLOT' }, (response) => {
          if (response.success) {
            clipboardSlots = response.slots;
            selectedSlotIndex = clipboardSlots.length - 1;
            updatePopupUI();
            scrollToSelectedSlot();
          }
        });
      } catch (err) {
        console.log('Copy0: Failed to add slot');
      }
    } else if (selectedSlotIndex < clipboardSlots.length) {
      selectedSlotIndex++;
      updatePopupUI();
      scrollToSelectedSlot();
    }
  }

  function scrollToSelectedSlot() {
    // Get the slots container and selected slot element
    const slotsContainer = document.querySelector('.copy0-slots-container');
    const selectedSlot = document.querySelector('.copy0-slot-selected');
    
    if (slotsContainer && selectedSlot) {
      // Scroll the selected slot into view
      selectedSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function lockSlot() {
    if (selectedSlotIndex < clipboardSlots.length) {
      const slot = clipboardSlots[selectedSlotIndex];
      try {
        chrome.runtime.sendMessage({ 
          action: 'UPDATE_SLOT', 
          slotId: slot.id, 
          locked: true 
        }, (response) => {
          if (response.success) {
            slot.locked = true;
            updatePopupUI();
          }
        });
      } catch (err) {
        console.log('Copy0: Failed to lock slot');
      }
    }
  }

  function unlockSlot() {
    if (selectedSlotIndex < clipboardSlots.length) {
      const slot = clipboardSlots[selectedSlotIndex];
      try {
        chrome.runtime.sendMessage({ 
          action: 'UPDATE_SLOT', 
          slotId: slot.id, 
          locked: false 
        }, (response) => {
          if (response.success) {
            slot.locked = false;
            updatePopupUI();
          }
        });
      } catch (err) {
        console.log('Copy0: Failed to unlock slot');
      }
    }
  }

  // Copy action when Ctrl+C is released
  async function handleCopyAction() {
    if (selectedSlotIndex < clipboardSlots.length) {
      try {
        // Read from clipboard
        const clipboardText = await navigator.clipboard.readText();
        const slot = clipboardSlots[selectedSlotIndex];
        
        // Get source domain
        const sourceUrl = window.location.hostname || window.location.href;
        
        // Update slot content
        chrome.runtime.sendMessage({ 
          action: 'UPDATE_SLOT', 
          slotId: slot.id, 
          content: clipboardText,
          locked: slot.locked, // Keep lock state
          source: sourceUrl
        }, (response) => {
          if (response && response.success) {
            slot.content = clipboardText;
            slot.source = sourceUrl;
            closePopup();
          }
        });
      } catch (err) {
        console.error('Copy0: Failed to read clipboard', err);
        closePopup();
      }
    } else {
      closePopup();
    }
  }

  // Paste action when Ctrl+V is released
  async function handlePasteAction() {
    if (selectedSlotIndex < clipboardSlots.length) {
      const slot = clipboardSlots[selectedSlotIndex];
      
      // Check if slot has content (locked or unlocked)
      if (slot.content) {
        try {
          // Write to clipboard
          await navigator.clipboard.writeText(slot.content);
          
          // Trigger paste by simulating the event
          document.execCommand('paste');
          closePopup();
        } catch (err) {
          console.error('Copy0: Failed to write to clipboard', err);
          closePopup();
        }
      } else {
        closePopup();
      }
    } else {
      closePopup();
    }
  }

  // UI Management
  function openPopup(mode) {
    if (isPopupActive) return;
    
    currentMode = mode;
    isPopupActive = true;
    selectedSlotIndex = 0;
    
    // Reload slots from background
    try {
      chrome.runtime.sendMessage({ action: 'GET_SLOTS' }, (response) => {
        if (response && response.slots) {
          clipboardSlots = response.slots;
          createPopupUI();
        }
      });
    } catch (err) {
      console.log('Copy0: Failed to get slots');
      closePopup();
    }
  }

  function closePopup() {
    if (popupContainer) {
      popupContainer.remove();
      popupContainer = null;
    }
    if (previewContainer) {
      previewContainer.remove();
      previewContainer = null;
    }
    isPopupActive = false;
    currentMode = null;
    selectedSlotIndex = 0;
  }

  function createPopupUI() {
    // Create main popup container
    popupContainer = document.createElement('div');
    popupContainer.id = 'copy0-popup';
    popupContainer.className = 'copy0-popup';
    
    // Add mode indicator
    const modeIndicator = document.createElement('div');
    modeIndicator.className = 'copy0-mode-indicator';
    modeIndicator.textContent = currentMode === 'copy' ? 'COPY MODE' : 'PASTE MODE';
    popupContainer.appendChild(modeIndicator);
    
    // Add slots container
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'copy0-slots-container';
    popupContainer.appendChild(slotsContainer);
    
    // Render slots
    renderSlots(slotsContainer);
    
    document.body.appendChild(popupContainer);
    updatePopupUI();
  }

  function renderSlots(container) {
    container.innerHTML = '';
    
    // Render all slots
    clipboardSlots.forEach((slot, index) => {
      const slotElement = document.createElement('div');
      slotElement.className = 'copy0-slot';
      slotElement.dataset.slotIndex = index;
      
      if (index === selectedSlotIndex) {
        slotElement.classList.add('copy0-slot-selected');
      }
      
      // Slot content
      const slotContent = document.createElement('div');
      slotContent.className = 'copy0-slot-content';
      
      if (!slot.content) {
        // Empty slot
        slotContent.textContent = '';
        slotElement.classList.add('copy0-slot-empty');
      } else if (slot.locked) {
        // Locked slot
        slotContent.textContent = '••••••••••••••••••••';
        slotElement.classList.add('copy0-slot-locked');
      } else {
        // Filled slot with truncated preview
        slotContent.textContent = truncateText(slot.content);
        slotElement.classList.add('copy0-slot-filled');
        
        // Add filled indicator
        const filledTag = document.createElement('span');
        filledTag.className = 'copy0-filled-tag';
        filledTag.textContent = '●';
        slotElement.appendChild(filledTag);
      }
      
      slotElement.appendChild(slotContent);
      container.appendChild(slotElement);
    });
    
    // Add "+ Add slot" option
    const addSlotElement = document.createElement('div');
    addSlotElement.className = 'copy0-slot copy0-add-slot';
    if (selectedSlotIndex === clipboardSlots.length) {
      addSlotElement.classList.add('copy0-slot-selected');
    }
    addSlotElement.textContent = '+ Add slot';
    container.appendChild(addSlotElement);
  }

  function updatePopupUI() {
    if (!popupContainer) return;
    
    const slotsContainer = popupContainer.querySelector('.copy0-slots-container');
    renderSlots(slotsContainer);
    
    // Update preview popup
    updatePreviewPopup();
  }

  function updatePreviewPopup() {
    // Remove existing preview
    if (previewContainer) {
      previewContainer.remove();
      previewContainer = null;
    }
    
    // Show preview for all slots with content (locked or unlocked)
    if (selectedSlotIndex < clipboardSlots.length) {
      const slot = clipboardSlots[selectedSlotIndex];
      
      if (slot.content) {
        createPreviewPopup(slot.content, slot.locked, slot.source);
      }
    }
  }

  function createPreviewPopup(content, isLocked = false, source = '') {
    previewContainer = document.createElement('div');
    previewContainer.className = 'copy0-preview';
    
    // Show source URL if available
    if (source) {
      const sourceLabel = document.createElement('div');
      sourceLabel.className = 'copy0-preview-source';
      sourceLabel.textContent = source;
      previewContainer.appendChild(sourceLabel);
    }
    
    const previewContent = document.createElement('div');
    previewContent.className = 'copy0-preview-content';
    
    if (isLocked) {
      previewContent.textContent = '';
      previewContent.style.fontStyle = 'italic';
      previewContent.style.color = '#666';
    } else {
      previewContent.textContent = content;
    }
    
    previewContainer.appendChild(previewContent);
    
    previewContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    }, { passive: false });
    
    document.body.appendChild(previewContainer);
  }

  function truncateText(text, maxLength = 50) {
    // Single line, truncate with ellipsis
    const singleLine = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (singleLine.length <= maxLength) {
      return singleLine;
    }
    return singleLine.substring(0, maxLength) + '...';
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
