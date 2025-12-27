import { GoogleGenAI } from '@google/genai';

chrome.runtime.onMessage.addListener((msg, _, send) => {
  if (msg.type !== 'ANALYZE') return;

  (async () => {
    const { apiKey, prompt } = await chrome.storage.local.get(['apiKey','prompt']);
    if (!apiKey) return send({ detected: [] });

    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = `
Return ONLY JSON: {"detected":[numbers]}
Rules: ragebait, bait, idiot posts.
Extra user rules: ${prompt || 'none'}

${msg.payload}
`;

    const r = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [{ role: 'user', parts: [{ text: fullPrompt }]}]
    });

    send(JSON.parse(r.response.text()));
  })();

  return true;
});
