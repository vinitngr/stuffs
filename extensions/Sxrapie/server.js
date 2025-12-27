const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const detectHtml = fs.readFileSync(path.join(__dirname, 'detect.html'), 'utf8');

const server = http.createServer((req, res) => {
  const url = req.url;
  
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url}`);
  
  const profileMatch = url.match(/^\/in\/([^\/]+)\/?$/);
  
  if (profileMatch) {
    const profileName = profileMatch[1];
    console.log(`  → Serving profile: ${profileName}`);
    
    const customHtml = detectHtml.replace(
      '<h2>Vinit Nagar</h2>',
      `<h2>${profileName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h2>`
    );
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(customHtml);
  } 
  else if (url === '/' || url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ghost Scraper Test Server</title>
        <style>
          body { background: #0d1117; color: #c9d1d9; font-family: monospace; padding: 40px; }
          h1 { color: #58a6ff; }
          a { color: #00ff88; }
          code { background: #161b22; padding: 4px 8px; border-radius: 4px; }
          .example { margin: 10px 0; padding: 15px; background: #161b22; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>👻 Ghost Scraper Test Server</h1>
        <p>Server running on port ${PORT}</p>
        
        <h2>✅ Valid URLs (will trigger auto-capture):</h2>
        <div class="example">
          <a href="/in/john-doe">/in/john-doe</a><br><br>
          <a href="/in/vinit-nagar-264434293">/in/vinit-nagar-264434293</a><br><br>
          <a href="/in/test-profile">/in/test-profile</a>
        </div>
        
        <h2>❌ Invalid URLs (won't trigger):</h2>
        <div class="example">
          <code>/in/profile/settings</code> - has extra path<br>
          <code>/profile/john</code> - missing /in/<br>
          <code>/in/</code> - no profile name
        </div>
        
        <h2>📋 Instructions:</h2>
        <ol>
          <li>Load Ghost Scraper v4 extension</li>
          <li>Click any valid URL above</li>
          <li>Watch for ⏳ then A✓ badge</li>
          <li>Check if detection panel shows anything (it shouldn't!)</li>
        </ol>
      </body>
      </html>
    `);
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
      <body style="background:#0d1117;color:#ff6666;font-family:monospace;padding:40px;">
        <h1>404 - Not a valid profile URL</h1>
        <p>URL: ${url}</p>
        <p>Pattern required: /in/{profile-name}</p>
        <a href="/" style="color:#58a6ff;">← Back to home</a>
      </body>
      </html>
    `);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n👻 Ghost Scraper Test Server`);
  console.log(`================================`);
  console.log(`Server running at: http://127.0.0.1:${PORT}`);
  console.log(`\nTest URLs:`);
  console.log(`  http://127.0.0.1:${PORT}/in/john-doe`);
  console.log(`  http://127.0.0.1:${PORT}/in/test-profile`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
