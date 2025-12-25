const { search } = require('./search_engine.js');
const fs = require('fs');

// Full benchmark - all 88 questions from final_benchmark.js
const BENCHMARK_FILE1 = {
  file: '../test.file.js',
  questions: [
    { query: "How does the system retry failed tasks with exponential backoff?", truth: { start: 78, end: 93 } },
    { query: "Where is the exponential delay calculated for retries?", truth: { start: 86, end: 92 } },
    { query: "How many retry attempts are allowed per task?", truth: { start: 75, end: 93 } },
    { query: "Where are task attempts incremented?", truth: { start: 81, end: 84 } },
    { query: "Where are system health metrics computed?", truth: { start: 96, end: 105 } },
    { query: "How is system uptime calculated?", truth: { start: 96, end: 101 } },
    { query: "Where is success rate derived from completed and failed tasks?", truth: { start: 98, end: 104 } },
    { query: "Where are active and queued tasks counted?", truth: { start: 97, end: 100 } },
    { query: "Where are tasks registered into the system?", truth: { start: 33, end: 63 } },
    { query: "How are tasks added to the execution queue?", truth: { start: 44, end: 50 } },
    { query: "Where does task processing start automatically?", truth: { start: 52, end: 55 } },
    { query: "How does the system enforce concurrency limits?", truth: { start: 57, end: 70 } },
    { query: "Where is running task count incremented and decremented?", truth: { start: 65, end: 74 } },
    { query: "Where does task execution actually happen?", truth: { start: 60, end: 74 } },
    { query: "Where are task success events emitted?", truth: { start: 66, end: 69 } },
    { query: "Where are task failure events handled?", truth: { start: 69, end: 73 } },
    { query: "Where is database cleanup simulated?", truth: { start: 155, end: 160 } },
    { query: "What logic simulates database failure?", truth: { start: 156, end: 159 } },
    { query: "Where are image processing tasks created?", truth: { start: 163, end: 170 } },
    { query: "How does the system periodically report status?", truth: { start: 173, end: 189 } },
    { query: "Where are metrics exported to disk?", truth: { start: 118, end: 134 } },
    { query: "How does the system handle graceful shutdown on SIGINT?", truth: { start: 229, end: 232 } },
    { query: "How is disk usage calculated recursively?", truth: { start: 247, end: 260 } },
    { query: "Where is configuration loaded from environment variables?", truth: { start: 268, end: 284 } },
  ]
};

const BENCHMARK_FILE2 = {
  file: '../test2.file.js',
  questions: [
    { query: "Where does the cache store values with TTL?", truth: { start: 16, end: 21 } },
    { query: "How does the cache retrieve values and track hits/misses?", truth: { start: 22, end: 35 } },
    { query: "Where is automatic cache cleanup scheduled?", truth: { start: 37, end: 44 } },
    { query: "How are cache hit rate statistics calculated?", truth: { start: 46, end: 56 } },
    { query: "Where are rate limiter tokens refilled over time?", truth: { start: 75, end: 84 } },
    { query: "How does the system check if a request is rate limited?", truth: { start: 85, end: 102 } },
    { query: "Where are clients blocked for exceeding limits?", truth: { start: 104, end: 107 } },
    { query: "How is client block status verified?", truth: { start: 108, end: 116 } },
    { query: "Where are HTTP requests logged with metadata?", truth: { start: 129, end: 145 } },
    { query: "How does the logger rotate old entries?", truth: { start: 147, end: 152 } },
    { query: "Where is the request error rate calculated?", truth: { start: 162, end: 166 } },
    { query: "How can logs be searched with filters?", truth: { start: 167, end: 176 } },
    { query: "Where is middleware added to the router?", truth: { start: 188, end: 190 } },
    { query: "How are routes added with method and path?", truth: { start: 192, end: 195 } },
    { query: "How does the router execute middleware in sequence?", truth: { start: 217, end: 229 } },
    { query: "Where does the router match and dispatch to handlers?", truth: { start: 231, end: 245 } },
    { query: "Where is the Bearer token authentication checked?", truth: { start: 279, end: 292 } },
    { query: "How are authentication tokens validated?", truth: { start: 287, end: 296 } },
    { query: "Where are user sessions created with IDs?", truth: { start: 349, end: 361 } },
    { query: "How are unique session IDs generated?", truth: { start: 362, end: 364 } },
    { query: "Where is session data retrieved and validated?", truth: { start: 365, end: 377 } },
    { query: "How are expired sessions cleaned up?", truth: { start: 382, end: 391 } },
    { query: "Where is email format validated with regex?", truth: { start: 399, end: 403 } },
    { query: "How are password requirements enforced?", truth: { start: 404, end: 409 } },
    { query: "Where is user input sanitized for XSS?", truth: { start: 416, end: 424 } },
    { query: "How does the pool acquire database connections?", truth: { start: 453, end: 464 } },
    { query: "Where are connections released back to the pool?", truth: { start: 466, end: 477 } },
    { query: "How are event listeners subscribed?", truth: { start: 498, end: 508 } },
    { query: "Where are events published to subscribers?", truth: { start: 514, end: 530 } },
    { query: "How does the circuit breaker protect function calls?", truth: { start: 572, end: 590 } },
  ]
};

const BENCHMARK_FILE3 = {
  file: '../test3.file.js',
  questions: [
    { query: "How are new services registered with endpoints?", truth: { start: 14, end: 27 } },
    { query: "Where is a service deregistered by ID?", truth: { start: 30, end: 40 } },
    { query: "How does service discovery find healthy instances?", truth: { start: 43, end: 51 } },
    { query: "Where is heartbeat updated for a service?", truth: { start: 54, end: 60 } },
    { query: "How are stale services detected and marked unhealthy?", truth: { start: 63, end: 73 } },
    { query: "How does round-robin select the next server?", truth: { start: 82, end: 88 } },
    { query: "Where is the server with least connections selected?", truth: { start: 91, end: 107 } },
    { query: "How does weighted selection distribute traffic?", truth: { start: 110, end: 123 } },
    { query: "Where is connection tracking started for a server?", truth: { start: 139, end: 142 } },
    { query: "How are active connections decremented?", truth: { start: 145, end: 148 } },
    { query: "How is API key validated for expiry?", truth: { start: 161, end: 169 } },
    { query: "Where are new API keys registered?", truth: { start: 172, end: 179 } },
    { query: "How does rate limiting check request counts?", truth: { start: 182, end: 196 } },
    { query: "Where are requests routed to backend services?", truth: { start: 199, end: 217 } },
    { query: "How is the request forwarded to the endpoint?", truth: { start: 220, end: 232 } },
    { query: "Where is a new message queue created?", truth: { start: 242, end: 253 } },
    { query: "How are messages published with priority?", truth: { start: 256, end: 280 } },
    { query: "Where is a message consumed from the queue?", truth: { start: 283, end: 293 } },
    { query: "How are failed messages moved to dead letter queue?", truth: { start: 301, end: 308 } },
    { query: "Where are queue subscribers notified?", truth: { start: 318, end: 328 } },
    { query: "How is a distributed lock acquired with timeout?", truth: { start: 338, end: 357 } },
    { query: "Where does the system wait for lock release?", truth: { start: 360, end: 372 } },
    { query: "How is a lock released and waiting queue processed?", truth: { start: 375, end: 410 } },
    { query: "Where is lock duration extended?", truth: { start: 413, end: 422 } },
    { query: "How is a single health check executed?", truth: { start: 441, end: 466 } },
    { query: "Where are all health checks run together?", truth: { start: 469, end: 475 } },
    { query: "How is overall system health status determined?", truth: { start: 478, end: 494 } },
    { query: "Where is periodic health monitoring started?", truth: { start: 497, end: 505 } },
    { query: "How is exponential backoff delay calculated with jitter?", truth: { start: 524, end: 531 } },
    { query: "Where is function executed with retry logic?", truth: { start: 534, end: 550 } },
    { query: "How does the system determine if an error is retryable?", truth: { start: 553, end: 563 } },
    { query: "Where is configuration value set with versioning?", truth: { start: 578, end: 591 } },
    { query: "How are configuration watchers notified of changes?", truth: { start: 607, end: 616 } },
    { query: "Where is configuration loaded from an object?", truth: { start: 628, end: 632 } },
  ]
};

const allBenchmarks = [BENCHMARK_FILE1, BENCHMARK_FILE2, BENCHMARK_FILE3];

console.log('=== FULL BENCHMARK TEST (88 questions) ===\n');

let totalTop1 = 0, totalTop3 = 0, totalTop5 = 0;
let totalQuestions = 0;

allBenchmarks.forEach(bm => {
  const code = fs.readFileSync(bm.file, 'utf-8');
  let fileTop1 = 0, fileTop3 = 0;
  
  bm.questions.forEach(q => {
    totalQuestions++;
    const results = search(code, q.query, { topK: 5, minLines: 5, maxLines: 80, smartExpand: false });
    
    const checkHit = (r) => {
      const overlapStart = Math.max(r.start, q.truth.start);
      const overlapEnd = Math.min(r.end, q.truth.end);
      return overlapEnd >= overlapStart; // Any overlap = hit
    };
    
    const top1Hit = results[0] && checkHit(results[0]);
    const top3Hit = results.slice(0, 3).some(checkHit);
    const top5Hit = results.some(checkHit);
    
    totalTop1 += top1Hit ? 1 : 0;
    totalTop3 += top3Hit ? 1 : 0;
    totalTop5 += top5Hit ? 1 : 0;
    fileTop1 += top1Hit ? 1 : 0;
    fileTop3 += top3Hit ? 1 : 0;
  });
  
  console.log(`${bm.file}: Top-1: ${((fileTop1/bm.questions.length)*100).toFixed(0)}% | Top-3: ${((fileTop3/bm.questions.length)*100).toFixed(0)}%`);
});

console.log(`
${'═'.repeat(55)}
📊 FINAL RESULTS (${totalQuestions} questions):

   Top-1 Accuracy: ${((totalTop1/totalQuestions)*100).toFixed(1)}% (${totalTop1}/${totalQuestions})
   Top-3 Accuracy: ${((totalTop3/totalQuestions)*100).toFixed(1)}% (${totalTop3}/${totalQuestions})  ← FOR AI
   Top-5 Accuracy: ${((totalTop5/totalQuestions)*100).toFixed(1)}% (${totalTop5}/${totalQuestions})
${'═'.repeat(55)}
`);
