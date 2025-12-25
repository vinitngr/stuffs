const fs = require("fs");
const { functionNameYouGive: geminiFn } = require("./gemini.js");
const { functionNameYouGive: gptFn } = require("./gpt.js");
const { findTopRelevantLineRangesClaude: claudeFn } = require("./claude.js");
const { findTopRelevantLineRanges: dsFn } = require("./deepseek.js");

const TEST_FILE = "test2.file.js";
const code = fs.readFileSync(TEST_FILE, "utf-8");

// 30 benchmark questions for test2.file.js - CORRECTED LINE NUMBERS
const questions = [
  // Cache Manager (Lines 8-62)
  { id: "Q1", name: "Cache Set Operation", query: "Where does the cache store values with TTL?", truth: { start: 16, end: 21 } },
  { id: "Q2", name: "Cache Get Logic", query: "How does the cache retrieve values and track hits/misses?", truth: { start: 22, end: 35 } },
  { id: "Q3", name: "Cache Cleanup Scheduler", query: "Where is automatic cache cleanup scheduled?", truth: { start: 37, end: 44 } },
  { id: "Q4", name: "Cache Statistics", query: "How are cache hit rate statistics calculated?", truth: { start: 46, end: 56 } },
  
  // Rate Limiter (Lines 66-118)
  { id: "Q5", name: "Token Bucket Refill", query: "Where are rate limiter tokens refilled over time?", truth: { start: 75, end: 84 } },
  { id: "Q6", name: "Rate Limit Check", query: "How does the system check if a request is rate limited?", truth: { start: 85, end: 102 } },
  { id: "Q7", name: "Client Blocking", query: "Where are clients blocked for exceeding limits?", truth: { start: 104, end: 107 } },
  { id: "Q8", name: "Block Status Check", query: "How is client block status verified?", truth: { start: 108, end: 116 } },
  
  // Request Logger (Lines 121-178)
  { id: "Q9", name: "Request Logging", query: "Where are HTTP requests logged with metadata?", truth: { start: 129, end: 145 } },
  { id: "Q10", name: "Log Rotation", query: "How does the logger rotate old entries?", truth: { start: 147, end: 152 } },
  { id: "Q11", name: "Error Rate Calculation", query: "Where is the request error rate calculated?", truth: { start: 162, end: 166 } },
  { id: "Q12", name: "Log Search Filter", query: "How can logs be searched with filters?", truth: { start: 167, end: 176 } },
  
  // Router (Lines 181-248)
  { id: "Q13", name: "Middleware Registration", query: "Where is middleware added to the router?", truth: { start: 188, end: 190 } },
  { id: "Q14", name: "Route Registration", query: "How are routes added with method and path?", truth: { start: 192, end: 195 } },
  { id: "Q15", name: "Middleware Execution Chain", query: "How does the router execute middleware in sequence?", truth: { start: 217, end: 229 } },
  { id: "Q16", name: "Route Handler Dispatch", query: "Where does the router match and dispatch to handlers?", truth: { start: 231, end: 245 } },
  
  // Authentication (Lines 258-292)
  { id: "Q17", name: "Auth Middleware", query: "Where is the Bearer token authentication checked?", truth: { start: 279, end: 292 } },
  { id: "Q18", name: "Token Validation", query: "How are authentication tokens validated?", truth: { start: 287, end: 296 } },
  
  // Session Management (Lines 343-395)
  { id: "Q19", name: "Session Creation", query: "Where are user sessions created with IDs?", truth: { start: 349, end: 361 } },
  { id: "Q20", name: "Session ID Generation", query: "How are unique session IDs generated?", truth: { start: 362, end: 364 } },
  { id: "Q21", name: "Session Retrieval", query: "Where is session data retrieved and validated?", truth: { start: 365, end: 377 } },
  { id: "Q22", name: "Expired Session Cleanup", query: "How are expired sessions cleaned up?", truth: { start: 382, end: 391 } },
  
  // Validation (Lines 399-424)
  { id: "Q23", name: "Email Validation", query: "Where is email format validated with regex?", truth: { start: 399, end: 403 } },
  { id: "Q24", name: "Password Validation", query: "How are password requirements enforced?", truth: { start: 404, end: 409 } },
  { id: "Q25", name: "Input Sanitization", query: "Where is user input sanitized for XSS?", truth: { start: 416, end: 424 } },
  
  // Connection Pool (Lines 428-488)
  { id: "Q26", name: "Connection Acquisition", query: "How does the pool acquire database connections?", truth: { start: 453, end: 464 } },
  { id: "Q27", name: "Connection Release", query: "Where are connections released back to the pool?", truth: { start: 466, end: 477 } },
  
  // Event Bus (Lines 491-538)
  { id: "Q28", name: "Event Subscription", query: "How are event listeners subscribed?", truth: { start: 498, end: 508 } },
  { id: "Q29", name: "Event Publishing", query: "Where are events published to subscribers?", truth: { start: 514, end: 530 } },
  
  // Circuit Breaker (Lines 563-608)
  { id: "Q30", name: "Circuit Breaker Execute", query: "How does the circuit breaker protect function calls?", truth: { start: 572, end: 590 } },
];

function computeOverlap(predicted, truth) {
  const predLines = new Set();
  for (let i = predicted.start; i <= predicted.end; i++) predLines.add(i);

  let overlap = 0;
  for (let i = truth.start; i <= truth.end; i++) {
    if (predLines.has(i)) overlap++;
  }
  return overlap;
}

function computeMarks(overlap, truth) {
  const truthSize = truth.end - truth.start + 1;
  if (overlap === 0) return 0;
  if (overlap >= truthSize) return 10;
  return (overlap / truthSize) * 10;
}

function formatRange(r) {
  if (!r || r.start === undefined) return "N/A";
  return `L${r.start}-${r.end}`;
}

function runBenchmark() {
  console.log("\n📊 Line-Overlap Benchmark 2 - NEW TEST FILE (Partial Credit Enabled)\n");

  const engines = [
    { name: "Gemini-3.0-pro", fn: geminiFn },
    { name: "GPT-5.1-codex-max", fn: gptFn },
    { name: "Claude-Opus-4.5", fn: claudeFn },
    { name: "DeepSeek-R1", fn: dsFn },
  ];

  const totals = engines.reduce((acc, e) => ({ ...acc, [e.name]: 0 }), {});
  const maxScore = questions.length * 10;

  questions.forEach((q) => {
    console.log(`${q.id}: ${q.name}`);
    console.log(`Query: "${q.query}"`);
    console.log(`Truth: L${q.truth.start}-${q.truth.end}`);

    console.log("┌───────────────┬──────────────────┬────────────────┬──────────────┐");
    console.log("│ Engine        │ Top Result       │ Overlap Lines  │ Marks / 10   │");
    console.log("├───────────────┼──────────────────┼────────────────┼──────────────┤");

    engines.forEach(engine => {
      let top = { start: 0, end: 0 };

      try {
        const results = engine.fn(code, q.query);
        if (results && results.length > 0) top = results[0];
      } catch (e) {
        // Ignore engine errors to keep benchmark running
      }

      const overlap = computeOverlap(top, q.truth);
      const marks = computeMarks(overlap, q.truth);
      totals[engine.name] += marks;

      console.log(
        `│ ${engine.name.padEnd(13)} │ ${formatRange(top).padEnd(16)} │ ${String(overlap).padEnd(14)} │ ${marks.toFixed(2).padEnd(12)} │`
      );
    });

    console.log("└───────────────┴──────────────────┴────────────────┴──────────────┘");
    console.log("");
  });

  console.log("\n🏆 FINAL STANDINGS (Max " + maxScore + ")\n");
  console.log("┌────────┬───────────────┬───────────────┬───────────────┐");
  console.log("│ Rank   │ Engine        │ Total Marks   │ Accuracy      │");
  console.log("├────────┼───────────────┼───────────────┼───────────────┤");

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([engine, score], idx) => {
    const pct = ((score / maxScore) * 100).toFixed(1);
    console.log(
      `│ #${idx + 1}     │ ${engine.padEnd(13)} │ ${score.toFixed(2).padEnd(13)} │ ${(pct + "%").padEnd(13)} │`
    );
  });

  console.log("└────────┴───────────────┴───────────────┴───────────────┘");

  // Save results
  const results = {
    testFile: TEST_FILE,
    timestamp: new Date().toISOString(),
    maxScore,
    scores: totals,
    accuracy: Object.fromEntries(
      Object.entries(totals).map(([name, score]) => [name, ((score / maxScore) * 100).toFixed(1) + "%"])
    ),
    questions: questions.map(q => ({
      id: q.id,
      name: q.name,
      query: q.query,
      truth: q.truth
    }))
  };
  
  fs.writeFileSync("benchmark2_results.json", JSON.stringify(results, null, 2));
  console.log("\n✔ JSON report written to benchmark2_results.json");
}

runBenchmark();
