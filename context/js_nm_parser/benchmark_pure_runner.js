const fs = require('fs');
const { functionNameYouGive: geminiPure } = require('./gemini_pure.js');

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
  { query: "Where is the token consumption logic?", truth: { start: 85, end: 101 }, description: "Token Consumption" },
  { query: "How does the system check if a client is blocked?", truth: { start: 107, end: 114 }, description: "Block Check" },
  { query: "How are requests logged with rotation?", truth: { start: 129, end: 148 }, description: "Request Logging" },
  { query: "Where does log rotation happen?", truth: { start: 150, end: 155 }, description: "Log Rotation Logic" },
  { query: "How can logs be searched with filters?", truth: { start: 166, end: 174 }, description: "Log Search" },
  { query: "How is middleware executed recursively?", truth: { start: 217, end: 229 }, description: "Middleware Execution" },
  { query: "Where are requests matched to routes?", truth: { start: 231, end: 246 }, description: "Route Matching" },
  { query: "How are new routes added to the router?", truth: { start: 192, end: 195 }, description: "Add Route" },
  { query: "Where is the request body parsed from the stream?", truth: { start: 261, end: 274 }, description: "Body Parsing" },
  { query: "How is the authorization header validated?", truth: { start: 279, end: 294 }, description: "Auth Validation" }
];

function calculateOverlap(pred, truth) {
  const start = Math.max(pred.start, truth.start);
  const end = Math.min(pred.end, truth.end);
  return Math.max(0, end - start + 1);
}

function runBenchmark(name, file, questions) {
  console.log(`\n--- Running ${name} ---`);
  const code = fs.readFileSync(file, 'utf8');
  let totalScore = 0;
  let maxTotalScore = questions.length * 10;

  questions.forEach(q => {
    const results = geminiPure(code, q.query);
    const best = results[0];
    
    const overlap = calculateOverlap(best, q.truth);
    const truthLen = q.truth.end - q.truth.start + 1;
    let marks = 0;
    
    if (overlap > 0) {
      const coverage = overlap / truthLen;
      if (coverage >= 0.5) marks = 10;
      else if (coverage >= 0.2) marks = 5;
      else marks = 1;
    }

    totalScore += marks;
    console.log(`Q: ${q.query.substring(0, 40)}... | Score: ${marks}/10 | Overlap: ${overlap}`);
  });

  console.log(`Total Score: ${totalScore}/${maxTotalScore} (${(totalScore/maxTotalScore*100).toFixed(2)}%)`);
  return totalScore;
}

const score1 = runBenchmark("Benchmark 1 (test.file.js)", "test.file.js", BENCH1_QUESTIONS);
const score2 = runBenchmark("Benchmark 2 (test2.file.js)", "test2.file.js", BENCH2_QUESTIONS);

console.log(`\nCombined Score: ${score1 + score2}/${280 + 160}`);
