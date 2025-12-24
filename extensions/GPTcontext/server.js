const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/context/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const steps = [
      'Connecting to context engine',
      'Searching the internet',
      'Fetching relevant sources',
      'Reading documentation',
      'Synthesizing context'
    ];

    steps.forEach((label, i) => {
      setTimeout(() => {
        send('step', { label });
      }, i * 600);
    });

    setTimeout(() => {
      send('done', {
        context: `
[Context Injection Active]

- User is building a Chrome extension
- Streaming status UI above composer
- Inject context before final send
- Expect precise, production-ready answers
        `.trim()
      });
      res.end();
    }, steps.length * 600 + 400);

    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3000, () => {
  console.log('🚀 Context stream server on http://127.0.0.1:3000');
});
