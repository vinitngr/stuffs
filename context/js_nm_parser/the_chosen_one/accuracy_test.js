const { search } = require('./search_engine.js');
const fs = require('fs');

// More comprehensive test - 15 questions
const tests = [
  // test.file.js
  { file: '../test.file.js', query: 'retry logic exponential backoff', truth: { start: 78, end: 93 } },
  { file: '../test.file.js', query: 'where are tasks registered', truth: { start: 33, end: 63 } },
  { file: '../test.file.js', query: 'system health metrics computed', truth: { start: 96, end: 105 } },
  { file: '../test.file.js', query: 'task success events emitted', truth: { start: 66, end: 69 } },
  { file: '../test.file.js', query: 'disk usage calculated recursively', truth: { start: 247, end: 260 } },
  
  // test2.file.js
  { file: '../test2.file.js', query: 'cache store values with TTL', truth: { start: 16, end: 21 } },
  { file: '../test2.file.js', query: 'rate limiter tokens refilled', truth: { start: 75, end: 84 } },
  { file: '../test2.file.js', query: 'session created with ID', truth: { start: 349, end: 361 } },
  { file: '../test2.file.js', query: 'middleware execute sequence', truth: { start: 217, end: 229 } },
  { file: '../test2.file.js', query: 'email validated regex', truth: { start: 399, end: 403 } },
  
  // test3.file.js
  { file: '../test3.file.js', query: 'round robin select server', truth: { start: 82, end: 88 } },
  { file: '../test3.file.js', query: 'distributed lock acquired timeout', truth: { start: 338, end: 357 } },
  { file: '../test3.file.js', query: 'message queue publish priority', truth: { start: 256, end: 280 } },
  { file: '../test3.file.js', query: 'health check executed', truth: { start: 441, end: 466 } },
  { file: '../test3.file.js', query: 'service registered endpoint', truth: { start: 14, end: 27 } },
];

console.log('=== COMPREHENSIVE ACCURACY TEST (15 questions) ===\n');

let hitsTop1 = 0;
let hitsTop3 = 0;

tests.forEach((t, i) => {
  const code = fs.readFileSync(t.file, 'utf-8');
  const results = search(code, t.query, { topK: 3, minLines: 5, maxLines: 80, smartExpand: false });
  
  const checkHit = (r) => {
    const overlapStart = Math.max(r.start, t.truth.start);
    const overlapEnd = Math.min(r.end, t.truth.end);
    const overlap = Math.max(0, overlapEnd - overlapStart + 1);
    const truthSize = t.truth.end - t.truth.start + 1;
    return overlap / truthSize >= 0.5;
  };
  
  const top1Hit = results[0] && checkHit(results[0]);
  const top3Hit = results.some(checkHit);
  
  hitsTop1 += top1Hit ? 1 : 0;
  hitsTop3 += top3Hit ? 1 : 0;
  
  const status = top1Hit ? '✅' : top3Hit ? '🟡' : '❌';
  console.log(`${status} Q${String(i+1).padStart(2)}: ${t.query.substring(0,35).padEnd(35)} | Truth: L${t.truth.start}-${t.truth.end}`);
});

console.log(`
══════════════════════════════════════════════════
📊 RESULTS:
   Top-1 Accuracy: ${((hitsTop1/tests.length)*100).toFixed(1)}% (${hitsTop1}/${tests.length})
   Top-3 Accuracy: ${((hitsTop3/tests.length)*100).toFixed(1)}% (${hitsTop3}/${tests.length})
══════════════════════════════════════════════════
`);
