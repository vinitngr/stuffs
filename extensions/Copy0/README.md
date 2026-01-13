# Copy0 - Session Clipboard Manager

A Chrome extension (Manifest V3) that provides a keyboard-driven, session-only clipboard manager with long-press shortcuts.

## 🎯 Core Features

- **Session-Only Storage**: All clipboard data exists only during the browser session. Close the browser → lose all data.
- **Long-Press Shortcuts**: Hold Ctrl+C or Ctrl+V for >300ms to activate the popup UI
- **Keyboard-Driven**: Navigate and manage slots entirely with keyboard arrows
- **Multiple Clipboard Slots**: Start with 3 slots, add more dynamically as needed
- **Slot Locking**: Hide sensitive content visually with the lock feature

## 🚀 How It Works

### Copy Mode (Ctrl+C)

1. **Quick press** Ctrl+C → Normal copy behavior (native)
2. **Long-press** Ctrl+C (hold for >300ms) → Opens popup UI in COPY MODE
3. While holding Ctrl:
   - **↑/↓** Navigate between slots
   - **←** Lock selected slot (hides content)
   - **→** Unlock selected slot (shows content)
4. **Release Ctrl+C** → Saves current clipboard content to selected slot

### Paste Mode (Ctrl+V)

1. **Quick press** Ctrl+V → Normal paste (most recent clipboard)
2. **Long-press** Ctrl+V (hold for >300ms) → Opens popup UI in PASTE MODE
3. While holding Ctrl:
   - **↑/↓** Navigate between slots
   - **→** Unlock locked slots
4. **Release Ctrl+V** → Pastes content from selected slot

### Slot Types

- **Empty Slot**: `|------ empty slot ------|`
- **Filled Slot**: Shows truncated text + green indicator (●)
- **Locked Slot**: Shows `••••••••••••••` instead of content
- **Add Slot**: Navigate to bottom `+ Add slot` and press ↓ to create new slot

### Preview Popup

When you navigate to a filled (unlocked) slot, a secondary preview popup appears showing the full content. This never appears for locked slots.

## 📦 Installation

### For Development

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `Copy0` folder
6. The extension is now active!

### For Production

1. Package the extension as a `.zip` or `.crx`
2. Submit to Chrome Web Store (or distribute privately)

## 🏗️ Project Structure

```
Copy0/
├── manifest.json      # Extension configuration (MV3)
├── background.js      # Service worker for state management
├── content.js         # Keyboard handling & UI injection
├── styles.css         # Popup styling
├── icon16.png         # 16x16 icon
├── icon48.png         # 48x48 icon
├── icon128.png        # 128x128 icon
└── README.md          # This file
```

## 🔧 Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Handles session-only state in memory
- **Content Script**: Injected into all pages for keyboard detection
- **No Persistent Storage**: All data lives in-memory only

### Permissions

- `activeTab`: Access current tab for content script injection
- `clipboardRead`: Read from system clipboard
- `clipboardWrite`: Write to system clipboard
- `<all_urls>`: Inject content script on all pages

### Browser Compatibility

- **Chrome**: ✅ Full support (MV3)
- **Edge**: ✅ Full support (Chromium-based)
- **Firefox**: ⚠️ May need modifications (MV3 support varies)
- **Safari**: ❌ Not supported (different extension API)

## 🎨 Customization

### Change Long-Press Delay

Edit `content.js`:
```javascript
const LONG_PRESS_DELAY = 300; // Change to 400, 500, etc.
```

### Modify Default Slot Count

Edit `background.js`:
```javascript
let clipboardSlots = [
  { id: 0, content: '', locked: false },
  { id: 1, content: '', locked: false },
  { id: 2, content: '', locked: false },
  // Add more default slots here
];
```

### Change Color Scheme

Edit `styles.css` - modify colors:
- Primary blue: `#3794ff`
- Green indicator: `#4ec9b0`
- Background: `#1e1e1e`
- Text: `#d4d4d4`

## 🐛 Troubleshooting

### Popup doesn't appear
- Make sure you're holding Ctrl+C/V for at least 300ms
- Check if extension is enabled in `chrome://extensions/`
- Try refreshing the page

### Clipboard not working
- Ensure clipboard permissions are granted
- Some websites may block clipboard access
- Try on a different website

### Extension resets slots
- This is expected! Slots are session-only
- Closing browser or reloading extension clears all data
- This is a feature, not a bug 😊

## 🔒 Privacy & Security

- **No Data Collection**: Zero telemetry, zero tracking
- **No Network Requests**: Everything works offline
- **No Persistent Storage**: Data never touches disk
- **Session-Only**: Complete privacy by design
- **Lock Feature**: Visual-only (not encryption)

## 📄 License

MIT License - Feel free to modify and distribute

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 🎯 Roadmap (Future Ideas)

- [ ] Customizable keyboard shortcuts
- [ ] Slot templates/favorites
- [ ] Rich text support
- [ ] Image clipboard support
- [ ] Search within slots
- [ ] Import/export session (manual)
- [ ] Themes (light/dark/custom)

## 💡 Tips & Tricks

1. **Quick Navigation**: Hold Ctrl and tap Up/Down rapidly to scan slots
2. **Lock Sensitive Data**: Use Left arrow to lock passwords/tokens
3. **Add Slots On-The-Fly**: Navigate to bottom and press Down to expand
4. **Escape Key**: Press ESC to close popup without action
5. **Practice**: Try on a test page to get familiar with the flow

---

**Made with ❤️ for keyboard-driven productivity**
