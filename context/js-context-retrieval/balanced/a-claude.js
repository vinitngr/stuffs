const fs = require('fs');

// PURE versions - no keyword expansions
const { findTopRelevantLineRangesPure: claudePure } = require('./claude_pure.js');

// Original biased versions for comparison
const { functionNameYouGive: geminiFn } = require('./gemini.js');
const { functionNameYouGive: gptFn } = require('./gpt.js');
const { findTopRelevantLineRangesClaude: claudeFn } = require('./claude.js');

// BENCHMARK 1 - test.file.js questions
const BENCH1_QUESTIONS = [
  { query: "How does the system retry failed tasks with exponential backoff?", truth: { start: 78, end: 93 }, description: "Retry Logic Core" },
  { query: "Where is the exponential delay calculated for retries?", truth: { start: 86, end: 92 }, description: "Retry Delay Calculation" },
  { query: "How many retry attempts are allowed per task?", truth: { start: 75, end: 93 }, description: "Retry Attempts Limit" },
  { query: "Where are task attempts incremented?", truth: { start: 81, end: 84 }, description: "Attempts Increment" },
  { query: "Where are system health metrics computed?", truth: { start: 96, end: 105 }, description: "Health Metrics Computation" },
  { query: "How is system uptime calculated?", truth: { start: 96, end: 101 }, description: "Uptime Calculation" },
  { query: "Where is success rate derived from completed and failed tasks?", truth: { start: 98, end: 104 }, description: "Success Rate Logic" },
  { query: "Where are active and queued tasks counted?", truth: { start: 97, end: 100 }, description: "Queue and Active Counts" },
  { query: "Where are tasks registered into the system?", truth: { start: 33, end: 63 }, description: "Task Registration" },
  { query: "How are tasks added to the execution queue?", truth: { start: 44, end: 50 }, description: "Queue Push Logic" },
  { query: "Where does task processing start automatically?", truth: { start: 52, end: 55 }, description: "Auto Queue Processing" },
  { query: "How does the system enforce concurrency limits?", truth: { start: 57, end: 70 }, description: "Concurrency Control" },
  { query: "Where is running task count incremented and decremented?", truth: { start: 65, end: 74 }, description: "Running Count Management" },
  { query: "Where does task execution actually happen?", truth: { start: 60, end: 74 }, description: "Task Execution Flow" },
  { query: "Where are task success events emitted?", truth: { start: 66, end: 69 }, description: "Task Success Event" },
  { query: "Where are task failure events handled?", truth: { start: 69, end: 73 }, description: "Task Failure Handling" },
  { query: "Where is database cleanup simulated?", truth: { start: 155, end: 160 }, description: "DB Cleanup Task" },
  { query: "What logic simulates database failure?", truth: { start: 156, end: 159 }, description: "DB Failure Simulation" },
  { query: "Where are image processing tasks created?", truth: { start: 163, end: 170 }, description: "Image Processing Tasks" },
  { query: "How does the system periodically report status?", truth: { start: 173, end: 189 }, description: "Periodic Status Reporting" },
  { query: "Where are metrics exported to disk?", truth: { start: 118, end: 134 }, description: "Metrics Export Logic" },
  { query: "Where is metrics history read back from storage?", truth: { start: 136, end: 144 }, description: "Metrics Read History" },
  { query: "How does the system handle graceful shutdown on SIGINT?", truth: { start: 229, end: 232 }, description: "SIGINT Shutdown Handler" },
  { query: "Where are unhandled promise rejections logged?", truth: { start: 234, end: 238 }, description: "Unhandled Rejection Handler" },
  { query: "How is disk usage calculated recursively?", truth: { start: 247, end: 260 }, description: "Disk Usage Calculation" },
  { query: "Where does the filesystem traversal happen?", truth: { start: 250, end: 259 }, description: "Filesystem Traversal" },
  { query: "Where is configuration loaded from environment variables?", truth: { start: 268, end: 284 }, description: "Configuration Manager" },
  { query: "Where is CPU intensive computation simulated?", truth: { start: 287, end: 296 }, description: "Complex Math Algorithm" }
];

// BENCHMARK 2 - test2.file.js questions
const BENCH2_QUESTIONS = [
  { query: "Where does the cache store values with TTL?", truth: { start: 16, end: 21 }, description: "Cache Set Operation" },
  { query: "How does the cache retrieve values and track hits/misses?", truth: { start: 22, end: 35 }, description: "Cache Get Logic" },
  { query: "Where is automatic cache cleanup scheduled?", truth: { start: 37, end: 44 }, description: "Cache Cleanup Scheduler" },
  { query: "How are cache hit rate statistics calculated?", truth: { start: 46, end: 56 }, description: "Cache Statistics" },
  { query: "Where are rate limiter tokens refilled over time?", truth: { start: 75, end: 84 }, description: "Token Bucket Refill" },
  { query: "How does the system check if a request is rate limited?", truth: { start: 85, end: 102 }, description: "Rate Limit Check" },
  { query: "Where are clients blocked for exceeding limits?", truth: { start: 104, end: 107 }, description: "Client Blocking" },
  { query: "How is client block status verified?", truth: { start: 108, end: 116 }, description: "Block Status Check" },
  { query: "Where are HTTP requests logged with metadata?", truth: { start: 129, end: 145 }, description: "Request Logging" },
  { query: "How does the logger rotate old entries?", truth: { start: 147, end: 152 }, description: "Log Rotation" },
  { query: "Where is the request error rate calculated?", truth: { start: 162, end: 166 }, description: "Error Rate Calculation" },
  { query: "How can logs be searched with filters?", truth: { start: 167, end: 176 }, description: "Log Search Filter" },
  { query: "Where is middleware added to the router?", truth: { start: 188, end: 190 }, description: "Middleware Registration" },
  { query: "How are routes added with method and path?", truth: { start: 192, end: 195 }, description: "Route Registration" },
  { query: "How does the router execute middleware in sequence?", truth: { start: 217, end: 229 }, description: "Middleware Execution Chain" },
  { query: "Where does the router match and dispatch to handlers?", truth: { start: 231, end: 245 }, description: "Route Handler Dispatch" },
  { query: "Where is the Bearer token authentication checked?", truth: { start: 279, end: 292 }, description: "Auth Middleware" },
  { query: "How are authentication tokens validated?", truth: { start: 287, end: 296 }, description: "Token Validation" },
  { query: "Where are user sessions created with IDs?", truth: { start: 349, end: 361 }, description: "Session Creation" },
  { query: "How are unique session IDs generated?", truth: { start: 362, end: 364 }, description: "Session ID Generation" },
  { query: "Where is session data retrieved and validated?", truth: { start: 365, end: 377 }, description: "Session Retrieval" },
  { query: "How are expired sessions cleaned up?", truth: { start: 382, end: 391 }, description: "Expired Session Cleanup" },
  { query: "Where is email format validated with regex?", truth: { start: 399, end: 403 }, description: "Email Validation" },
  { query: "How are password requirements enforced?", truth: { start: 404, end: 409 }, description: "Password Validation" },
  { query: "Where is user input sanitized for XSS?", truth: { start: 416, end: 424 }, description: "Input Sanitization" },
  { query: "How does the pool acquire database connections?", truth: { start: 453, end: 464 }, description: "Connection Acquisition" },
  { query: "Where are connections released back to the pool?", truth: { start: 466, end: 477 }, description: "Connection Release" },
  { query: "How are event listeners subscribed?", truth: { start: 498, end: 508 }, description: "Event Subscription" },
  { query: "Where are events published to subscribers?", truth: { start: 514, end: 530 }, description: "Event Publishing" },
  { query: "How does the circuit breaker protect function calls?", truth: { start: 572, end: 590 }, description: "Circuit Breaker Execute" }
];

function overlapLines(a, b) {
  if (!a || !b || a.start === 0) return 0;
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start) + 1);
}

function calculateMarks(result, truth) {
  if (!result || result.start === 0) return 0;
  const overlap = overlapLines(result, truth);
  const truthSize = truth.end - truth.start + 1;
  return overlap === 0 ? 0 : Math.min(10, (overlap / truthSize) * 10);
}

function runSingleBenchmark(name, testFile, questions, engines) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log(`   File: ${testFile}`);
  console.log(`   Questions: ${questions.length}`);
  console.log(`${'='.repeat(60)}\n`);

  const code = fs.readFileSync(testFile, 'utf-8');
  const scores = {};
  engines.forEach(e => scores[e.name] = 0);

  questions.forEach((q, idx) => {
    console.log(`Q${idx + 1}: ${q.description}`);
    console.log(`   Query: "${q.query}"`);
    console.log(`   Truth: L${q.truth.start}-${q.truth.end}`);
    
    const results = {};
    engines.forEach(engine => {
      try {
        const res = engine.fn(code, q.query);
        const top = res && res[0] ? res[0] : { start: 0, end: 0 };
        const overlap = overlapLines(top, q.truth);
        const marks = calculateMarks(top, q.truth);
        scores[engine.name] += marks;
        results[engine.name] = { range: `L${top.start}-${top.end}`, overlap, marks: marks.toFixed(1) };
      } catch (e) {
        results[engine.name] = { range: 'ERROR', overlap: 0, marks: '0.0' };
      }
    });

    // Print results row
    const row = engines.map(e => `${e.name.substring(0,8)}: ${results[e.name].marks}`).join(' | ');
    console.log(`   Results: ${row}\n`);
  });

  const maxScore = questions.length * 10;
  console.log(`\n📈 ${name} - FINAL SCORES (Max ${maxScore}):`);
  console.log('-'.repeat(50));
  
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([engine, score], idx) => {
    const pct = ((score / maxScore) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(pct / 5));
    console.log(`  #${idx + 1} ${engine.padEnd(20)} ${score.toFixed(1).padStart(6)} / ${maxScore}  (${pct.padStart(5)}%) ${bar}`);
  });

  return { name, scores, maxScore };
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  🔬 KEYWORD-INDEPENDENT BENCHMARK COMPARISON');
  console.log('  Comparing BIASED (with keywords) vs PURE (no keywords) versions');
  console.log('═'.repeat(70));

  // Engines with keyword expansions (biased)
  const biasedEngines = [
    { name: 'Gemini (biased)', fn: geminiFn },
    { name: 'GPT (biased)', fn: gptFn },
    { name: 'Claude (biased)', fn: claudeFn },
  ];

  // Pure engine without keyword expansions
  const pureEngines = [
    { name: 'Claude (PURE)', fn: claudePure },
  ];

  // All engines for comparison
  const allEngines = [...biasedEngines, ...pureEngines];

  // Run benchmarks
  const results = [];
  
  if (fs.existsSync('test.file.js')) {
    results.push(runSingleBenchmark('BENCHMARK 1 (test.file.js)', 'test.file.js', BENCH1_QUESTIONS, allEngines));
  }
  
  if (fs.existsSync('test2.file.js')) {
    results.push(runSingleBenchmark('BENCHMARK 2 (test2.file.js)', 'test2.file.js', BENCH2_QUESTIONS, allEngines));
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 OVERALL SUMMARY - BIAS ANALYSIS');
  console.log('═'.repeat(70));
  
  results.forEach(r => {
    console.log(`\n${r.name}:`);
    const sorted = Object.entries(r.scores).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([engine, score]) => {
      const pct = ((score / r.maxScore) * 100).toFixed(1);
      const isBiased = engine.includes('biased');
      const marker = isBiased ? '⚠️  BIASED' : '✅ UNBIASED';
      console.log(`   ${marker}  ${engine.padEnd(20)} ${pct}%`);
    });
  });

  console.log('\n' + '─'.repeat(70));
  console.log('  KEY: Biased engines have hardcoded keyword expansions that may');
  console.log('       match test file terminology. PURE version has no such bias.');
  console.log('─'.repeat(70) + '\n');

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    analysis: 'keyword-independence',
    benchmarks: results
  };
  fs.writeFileSync('benchmark_pure_results.json', JSON.stringify(report, null, 2));
  console.log('✔ Results saved to benchmark_pure_results.json\n');
}

main().catch(console.error);
