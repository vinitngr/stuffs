const fs = require('fs');

// Import search engines - Claude PURE vs Gemini PURE
const { findTopRelevantLineRangesPure: claudePureFn } = require('./claude_pure.js');
const { functionNameYouGive: geminiPureFn } = require('./gemini_pure_v2.js');

// Also test biased versions for comparison
const { findTopRelevantLineRangesClaude: claudeBiasedFn } = require('./claude.js');
const { functionNameYouGive: geminiBiasedFn } = require('./gemini.js');

/**
 * COMPREHENSIVE FINAL BENCHMARK
 * Tests Claude PURE vs Gemini PURE across 3 test files
 * Combines all benchmarks, removes duplicates, uses best questions
 */

// ============== TEST FILE 1: Task Queue System ==============
const BENCHMARK_FILE1 = {
  file: 'test.file.js',
  name: 'Task Queue System',
  questions: [
    // Retry Logic (4 questions)
    { query: "How does the system retry failed tasks with exponential backoff?", truth: { start: 78, end: 93 }, category: "Retry" },
    { query: "Where is the exponential delay calculated for retries?", truth: { start: 86, end: 92 }, category: "Retry" },
    { query: "How many retry attempts are allowed per task?", truth: { start: 75, end: 93 }, category: "Retry" },
    { query: "Where are task attempts incremented?", truth: { start: 81, end: 84 }, category: "Retry" },
    
    // Health Metrics (4 questions)
    { query: "Where are system health metrics computed?", truth: { start: 96, end: 105 }, category: "Metrics" },
    { query: "How is system uptime calculated?", truth: { start: 96, end: 101 }, category: "Metrics" },
    { query: "Where is success rate derived from completed and failed tasks?", truth: { start: 98, end: 104 }, category: "Metrics" },
    { query: "Where are active and queued tasks counted?", truth: { start: 97, end: 100 }, category: "Metrics" },
    
    // Task Queue (6 questions)
    { query: "Where are tasks registered into the system?", truth: { start: 33, end: 63 }, category: "Queue" },
    { query: "How are tasks added to the execution queue?", truth: { start: 44, end: 50 }, category: "Queue" },
    { query: "Where does task processing start automatically?", truth: { start: 52, end: 55 }, category: "Queue" },
    { query: "How does the system enforce concurrency limits?", truth: { start: 57, end: 70 }, category: "Queue" },
    { query: "Where is running task count incremented and decremented?", truth: { start: 65, end: 74 }, category: "Queue" },
    { query: "Where does task execution actually happen?", truth: { start: 60, end: 74 }, category: "Queue" },
    
    // Events (2 questions)
    { query: "Where are task success events emitted?", truth: { start: 66, end: 69 }, category: "Events" },
    { query: "Where are task failure events handled?", truth: { start: 69, end: 73 }, category: "Events" },
    
    // Database (2 questions)
    { query: "Where is database cleanup simulated?", truth: { start: 155, end: 160 }, category: "Database" },
    { query: "What logic simulates database failure?", truth: { start: 156, end: 159 }, category: "Database" },
    
    // Miscellaneous (6 questions)
    { query: "Where are image processing tasks created?", truth: { start: 163, end: 170 }, category: "Tasks" },
    { query: "How does the system periodically report status?", truth: { start: 173, end: 189 }, category: "Status" },
    { query: "Where are metrics exported to disk?", truth: { start: 118, end: 134 }, category: "Metrics" },
    { query: "How does the system handle graceful shutdown on SIGINT?", truth: { start: 229, end: 232 }, category: "Lifecycle" },
    { query: "How is disk usage calculated recursively?", truth: { start: 247, end: 260 }, category: "Filesystem" },
    { query: "Where is configuration loaded from environment variables?", truth: { start: 268, end: 284 }, category: "Config" },
  ]
};

// ============== TEST FILE 2: Web Framework ==============
const BENCHMARK_FILE2 = {
  file: 'test2.file.js',
  name: 'Web Framework',
  questions: [
    // Cache (4 questions)
    { query: "Where does the cache store values with TTL?", truth: { start: 16, end: 21 }, category: "Cache" },
    { query: "How does the cache retrieve values and track hits/misses?", truth: { start: 22, end: 35 }, category: "Cache" },
    { query: "Where is automatic cache cleanup scheduled?", truth: { start: 37, end: 44 }, category: "Cache" },
    { query: "How are cache hit rate statistics calculated?", truth: { start: 46, end: 56 }, category: "Cache" },
    
    // Rate Limiter (4 questions)
    { query: "Where are rate limiter tokens refilled over time?", truth: { start: 75, end: 84 }, category: "RateLimiter" },
    { query: "How does the system check if a request is rate limited?", truth: { start: 85, end: 102 }, category: "RateLimiter" },
    { query: "Where are clients blocked for exceeding limits?", truth: { start: 104, end: 107 }, category: "RateLimiter" },
    { query: "How is client block status verified?", truth: { start: 108, end: 116 }, category: "RateLimiter" },
    
    // Logger (4 questions)
    { query: "Where are HTTP requests logged with metadata?", truth: { start: 129, end: 145 }, category: "Logger" },
    { query: "How does the logger rotate old entries?", truth: { start: 147, end: 152 }, category: "Logger" },
    { query: "Where is the request error rate calculated?", truth: { start: 162, end: 166 }, category: "Logger" },
    { query: "How can logs be searched with filters?", truth: { start: 167, end: 176 }, category: "Logger" },
    
    // Router (4 questions)
    { query: "Where is middleware added to the router?", truth: { start: 188, end: 190 }, category: "Router" },
    { query: "How are routes added with method and path?", truth: { start: 192, end: 195 }, category: "Router" },
    { query: "How does the router execute middleware in sequence?", truth: { start: 217, end: 229 }, category: "Router" },
    { query: "Where does the router match and dispatch to handlers?", truth: { start: 231, end: 245 }, category: "Router" },
    
    // Auth (2 questions)
    { query: "Where is the Bearer token authentication checked?", truth: { start: 279, end: 292 }, category: "Auth" },
    { query: "How are authentication tokens validated?", truth: { start: 287, end: 296 }, category: "Auth" },
    
    // Session (4 questions)
    { query: "Where are user sessions created with IDs?", truth: { start: 349, end: 361 }, category: "Session" },
    { query: "How are unique session IDs generated?", truth: { start: 362, end: 364 }, category: "Session" },
    { query: "Where is session data retrieved and validated?", truth: { start: 365, end: 377 }, category: "Session" },
    { query: "How are expired sessions cleaned up?", truth: { start: 382, end: 391 }, category: "Session" },
    
    // Validation (3 questions)
    { query: "Where is email format validated with regex?", truth: { start: 399, end: 403 }, category: "Validation" },
    { query: "How are password requirements enforced?", truth: { start: 404, end: 409 }, category: "Validation" },
    { query: "Where is user input sanitized for XSS?", truth: { start: 416, end: 424 }, category: "Validation" },
    
    // Connection Pool (2 questions)
    { query: "How does the pool acquire database connections?", truth: { start: 453, end: 464 }, category: "Database" },
    { query: "Where are connections released back to the pool?", truth: { start: 466, end: 477 }, category: "Database" },
    
    // Events (2 questions)
    { query: "How are event listeners subscribed?", truth: { start: 498, end: 508 }, category: "Events" },
    { query: "Where are events published to subscribers?", truth: { start: 514, end: 530 }, category: "Events" },
    
    // Circuit Breaker (1 question)
    { query: "How does the circuit breaker protect function calls?", truth: { start: 572, end: 590 }, category: "CircuitBreaker" },
  ]
};

// ============== TEST FILE 3: Microservices ==============
const BENCHMARK_FILE3 = {
  file: 'test3.file.js',
  name: 'Microservices Patterns',
  questions: [
    // Service Registry (5 questions)
    { query: "How are new services registered with endpoints?", truth: { start: 14, end: 27 }, category: "ServiceRegistry" },
    { query: "Where is a service deregistered by ID?", truth: { start: 30, end: 40 }, category: "ServiceRegistry" },
    { query: "How does service discovery find healthy instances?", truth: { start: 43, end: 51 }, category: "ServiceRegistry" },
    { query: "Where is heartbeat updated for a service?", truth: { start: 54, end: 60 }, category: "ServiceRegistry" },
    { query: "How are stale services detected and marked unhealthy?", truth: { start: 63, end: 73 }, category: "ServiceRegistry" },
    
    // Load Balancer (5 questions)
    { query: "How does round-robin select the next server?", truth: { start: 82, end: 88 }, category: "LoadBalancer" },
    { query: "Where is the server with least connections selected?", truth: { start: 91, end: 107 }, category: "LoadBalancer" },
    { query: "How does weighted selection distribute traffic?", truth: { start: 110, end: 123 }, category: "LoadBalancer" },
    { query: "Where is connection tracking started for a server?", truth: { start: 139, end: 142 }, category: "LoadBalancer" },
    { query: "How are active connections decremented?", truth: { start: 145, end: 148 }, category: "LoadBalancer" },
    
    // API Gateway (5 questions)
    { query: "How is API key validated for expiry?", truth: { start: 161, end: 169 }, category: "APIGateway" },
    { query: "Where are new API keys registered?", truth: { start: 172, end: 179 }, category: "APIGateway" },
    { query: "How does rate limiting check request counts?", truth: { start: 182, end: 196 }, category: "APIGateway" },
    { query: "Where are requests routed to backend services?", truth: { start: 199, end: 217 }, category: "APIGateway" },
    { query: "How is the request forwarded to the endpoint?", truth: { start: 220, end: 232 }, category: "APIGateway" },
    
    // Message Queue (5 questions)
    { query: "Where is a new message queue created?", truth: { start: 242, end: 253 }, category: "MessageQueue" },
    { query: "How are messages published with priority?", truth: { start: 256, end: 280 }, category: "MessageQueue" },
    { query: "Where is a message consumed from the queue?", truth: { start: 283, end: 293 }, category: "MessageQueue" },
    { query: "How are failed messages moved to dead letter queue?", truth: { start: 301, end: 308 }, category: "MessageQueue" },
    { query: "Where are queue subscribers notified?", truth: { start: 318, end: 328 }, category: "MessageQueue" },
    
    // Distributed Lock (4 questions)
    { query: "How is a distributed lock acquired with timeout?", truth: { start: 338, end: 357 }, category: "DistributedLock" },
    { query: "Where does the system wait for lock release?", truth: { start: 360, end: 372 }, category: "DistributedLock" },
    { query: "How is a lock released and waiting queue processed?", truth: { start: 375, end: 410 }, category: "DistributedLock" },
    { query: "Where is lock duration extended?", truth: { start: 413, end: 422 }, category: "DistributedLock" },
    
    // Health Monitor (4 questions)
    { query: "How is a single health check executed?", truth: { start: 441, end: 466 }, category: "HealthMonitor" },
    { query: "Where are all health checks run together?", truth: { start: 469, end: 475 }, category: "HealthMonitor" },
    { query: "How is overall system health status determined?", truth: { start: 478, end: 494 }, category: "HealthMonitor" },
    { query: "Where is periodic health monitoring started?", truth: { start: 497, end: 505 }, category: "HealthMonitor" },
    
    // Retry Handler (3 questions)
    { query: "How is exponential backoff delay calculated with jitter?", truth: { start: 524, end: 531 }, category: "RetryHandler" },
    { query: "Where is function executed with retry logic?", truth: { start: 534, end: 550 }, category: "RetryHandler" },
    { query: "How does the system determine if an error is retryable?", truth: { start: 553, end: 563 }, category: "RetryHandler" },
    
    // Config Store (3 questions)
    { query: "Where is configuration value set with versioning?", truth: { start: 578, end: 591 }, category: "ConfigStore" },
    { query: "How are configuration watchers notified of changes?", truth: { start: 607, end: 616 }, category: "ConfigStore" },
    { query: "Where is configuration loaded from an object?", truth: { start: 628, end: 632 }, category: "ConfigStore" },
  ]
};

// All benchmarks combined
const ALL_BENCHMARKS = [BENCHMARK_FILE1, BENCHMARK_FILE2, BENCHMARK_FILE3];

// ============== Scoring Functions ==============
function calculateOverlap(predicted, truth) {
  if (!predicted || predicted.start === 0) return 0;
  const overlapStart = Math.max(predicted.start, truth.start);
  const overlapEnd = Math.min(predicted.end, truth.end);
  return Math.max(0, overlapEnd - overlapStart + 1);
}

function calculateScore(predicted, truth) {
  const overlap = calculateOverlap(predicted, truth);
  const truthSize = truth.end - truth.start + 1;
  if (overlap === 0) return 0;
  return Math.min(10, (overlap / truthSize) * 10);
}

// ============== Run Benchmark ==============
async function runComprehensiveBenchmark() {
  console.log('\n' + '═'.repeat(70));
  console.log('  🏆 COMPREHENSIVE FINAL BENCHMARK');
  console.log('  Claude PURE v5 (natural) vs Gemini PURE v2');
  console.log('═'.repeat(70));

  const engines = [
    { name: 'Claude PURE', fn: claudePureFn, type: 'PURE' },
    { name: 'Gemini PURE', fn: geminiPureFn, type: 'PURE' },
    { name: 'Claude (biased)', fn: claudeBiasedFn, type: 'BIASED' },
    { name: 'Gemini (biased)', fn: geminiBiasedFn, type: 'BIASED' },
  ];

  const results = {
    timestamp: new Date().toISOString(),
    summary: {},
    byFile: [],
    byCategory: {},
    detailed: []
  };

  let grandTotals = {};
  engines.forEach(e => grandTotals[e.name] = { score: 0, questions: 0 });

  for (const benchmark of ALL_BENCHMARKS) {
    if (!fs.existsSync(benchmark.file)) {
      console.log(`\n⚠️  Skipping ${benchmark.file} - file not found`);
      continue;
    }

    const code = fs.readFileSync(benchmark.file, 'utf-8');
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📁 ${benchmark.name} (${benchmark.file})`);
    console.log(`   ${benchmark.questions.length} questions`);
    console.log('─'.repeat(70));

    const fileResults = {
      file: benchmark.file,
      name: benchmark.name,
      questions: benchmark.questions.length,
      scores: {},
      details: []
    };

    engines.forEach(e => fileResults.scores[e.name] = 0);

    for (let i = 0; i < benchmark.questions.length; i++) {
      const q = benchmark.questions[i];
      const questionResult = {
        query: q.query,
        truth: `L${q.truth.start}-${q.truth.end}`,
        category: q.category,
        results: {}
      };

      for (const engine of engines) {
        try {
          const engineResults = engine.fn(code, q.query);
          const topResult = engineResults[0];
          const score = calculateScore(topResult, q.truth);
          
          fileResults.scores[engine.name] += score;
          grandTotals[engine.name].score += score;
          grandTotals[engine.name].questions++;
          
          questionResult.results[engine.name] = {
            predicted: topResult ? `L${topResult.start}-${topResult.end}` : 'N/A',
            score: score.toFixed(1)
          };

          // Track by category
          if (!results.byCategory[q.category]) {
            results.byCategory[q.category] = {};
            engines.forEach(e => results.byCategory[q.category][e.name] = { score: 0, count: 0 });
          }
          results.byCategory[q.category][engine.name].score += score;
          results.byCategory[q.category][engine.name].count++;
        } catch (err) {
          questionResult.results[engine.name] = { error: err.message, score: '0.0' };
        }
      }

      fileResults.details.push(questionResult);
      
      // Print progress
      const scores = engines.map(e => `${e.name.substring(0, 8)}: ${questionResult.results[e.name]?.score || '0.0'}`);
      console.log(`Q${String(i + 1).padStart(2)}: ${scores.join(' | ')}`);
    }

    // File summary
    const maxScore = benchmark.questions.length * 10;
    console.log(`\n📊 ${benchmark.name} Results:`);
    engines.forEach(e => {
      const pct = ((fileResults.scores[e.name] / maxScore) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(pct / 5));
      console.log(`   ${e.name.padEnd(15)} ${fileResults.scores[e.name].toFixed(1).padStart(6)} / ${maxScore} (${pct}%) ${bar}`);
    });

    fileResults.maxScore = maxScore;
    results.byFile.push(fileResults);
  }

  // Grand totals
  console.log('\n' + '═'.repeat(70));
  console.log('  📈 GRAND TOTALS');
  console.log('═'.repeat(70));

  const totalQuestions = Object.values(grandTotals)[0].questions;
  const maxTotal = totalQuestions * 10;

  const sortedEngines = engines.sort((a, b) => 
    grandTotals[b.name].score - grandTotals[a.name].score
  );

  sortedEngines.forEach((e, idx) => {
    const score = grandTotals[e.name].score;
    const pct = ((score / maxTotal) * 100).toFixed(1);
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
    const type = e.type === 'PURE' ? '✅' : '⚠️';
    console.log(`${medal} ${type} ${e.name.padEnd(15)} ${score.toFixed(1).padStart(7)} / ${maxTotal} (${pct}%)`);
    
    results.summary[e.name] = {
      score: score,
      maxScore: maxTotal,
      percentage: parseFloat(pct),
      type: e.type
    };
  });

  // Save JSON results
  fs.writeFileSync('final_benchmark_results.json', JSON.stringify(results, null, 2));
  console.log('\n✔ Detailed results saved to final_benchmark_results.json');

  // Generate Markdown report
  generateMarkdownReport(results, engines);
  
  return results;
}

// ============== Generate Markdown Report ==============
function generateMarkdownReport(results, engines) {
  const now = new Date();
  let md = `# 🏆 Code Search Engine - Final Benchmark Results

> **Generated:** ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
> **Test Files:** ${results.byFile.length} files, ${Object.values(results.summary)[0]?.maxScore / 10 || 0} questions total

---

## 📊 Overall Results

| Rank | Engine | Type | Score | Percentage | Visual |
|:----:|--------|:----:|------:|:----------:|--------|
`;

  const sortedSummary = Object.entries(results.summary)
    .sort((a, b) => b[1].score - a[1].score);
  
  sortedSummary.forEach(([name, data], idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
    const type = data.type === 'PURE' ? '✅ PURE' : '⚠️ Biased';
    const bar = '█'.repeat(Math.round(data.percentage / 5)) + '░'.repeat(20 - Math.round(data.percentage / 5));
    md += `| ${medal} | **${name}** | ${type} | ${data.score.toFixed(1)} / ${data.maxScore} | ${data.percentage}% | \`${bar}\` |\n`;
  });

  md += `
---

## 📁 Results by Test File

`;

  results.byFile.forEach(file => {
    md += `### ${file.name} (\`${file.file}\`)

| Engine | Score | Percentage |
|--------|------:|:----------:|
`;
    
    const sortedScores = Object.entries(file.scores)
      .sort((a, b) => b[1] - a[1]);
    
    sortedScores.forEach(([name, score]) => {
      const pct = ((score / file.maxScore) * 100).toFixed(1);
      md += `| ${name} | ${score.toFixed(1)} / ${file.maxScore} | ${pct}% |\n`;
    });
    
    md += '\n';
  });

  md += `---

## 📂 Results by Category

`;

  const categories = Object.keys(results.byCategory).sort();
  
  md += `| Category | ${sortedSummary.map(([n]) => n.split(' ')[0]).join(' | ')} |
|----------|${sortedSummary.map(() => '------:').join('|')}|
`;

  categories.forEach(cat => {
    const catData = results.byCategory[cat];
    const row = sortedSummary.map(([name]) => {
      if (catData[name]) {
        const avg = (catData[name].score / catData[name].count).toFixed(1);
        return `${avg}/10`;
      }
      return '-';
    });
    md += `| ${cat} | ${row.join(' | ')} |\n`;
  });

  md += `
---

## 🔬 Analysis

### Winner: **${sortedSummary[0][0]}**

`;

  const winner = sortedSummary[0];
  const runnerUp = sortedSummary[1];
  const diff = winner[1].percentage - runnerUp[1].percentage;
  
  md += `- **Overall Score:** ${winner[1].score.toFixed(1)} / ${winner[1].maxScore} (${winner[1].percentage}%)
- **Lead over Runner-up:** +${diff.toFixed(1)} percentage points
- **Engine Type:** ${winner[1].type === 'PURE' ? 'Keyword-Independent (PURE)' : 'Keyword-Biased'}

### Key Insights

`;

  // Find best/worst categories for each engine
  const pureEngines = sortedSummary.filter(([_, d]) => d.type === 'PURE');
  const biasedEngines = sortedSummary.filter(([_, d]) => d.type === 'BIASED');

  if (pureEngines.length > 0 && biasedEngines.length > 0) {
    const bestPure = pureEngines[0];
    const bestBiased = biasedEngines[0];
    
    if (bestPure[1].percentage > bestBiased[1].percentage) {
      md += `✅ **PURE engines outperform biased engines** - The keyword-independent approach generalizes better across different codebases.

`;
    } else {
      md += `⚠️ **Biased engines still lead** - Keyword-specific tuning provides advantages on these test files.

`;
    }
  }

  md += `### Per-File Performance

`;

  results.byFile.forEach(file => {
    const winner = Object.entries(file.scores).sort((a, b) => b[1] - a[1])[0];
    const winnerType = results.summary[winner[0]]?.type || 'unknown';
    md += `- **${file.name}:** ${winner[0]} wins (${((winner[1] / file.maxScore) * 100).toFixed(1)}%) - ${winnerType === 'PURE' ? '✅ PURE' : '⚠️ Biased'}\n`;
  });

  md += `
---

## 📋 Detailed Question Results

<details>
<summary>Click to expand all ${results.byFile.reduce((sum, f) => sum + f.details.length, 0)} questions</summary>

`;

  results.byFile.forEach(file => {
    md += `### ${file.name}

| # | Category | Query | Truth | ${sortedSummary.slice(0, 2).map(([n]) => n).join(' | ')} |
|---|----------|-------|-------|${sortedSummary.slice(0, 2).map(() => '------').join('|')}|
`;

    file.details.forEach((q, idx) => {
      const topEngineResults = sortedSummary.slice(0, 2).map(([name]) => {
        const r = q.results[name];
        return r ? `${r.score}` : '-';
      });
      
      const shortQuery = q.query.length > 50 ? q.query.substring(0, 47) + '...' : q.query;
      md += `| ${idx + 1} | ${q.category} | ${shortQuery} | ${q.truth} | ${topEngineResults.join(' | ')} |\n`;
    });
    
    md += '\n';
  });

  md += `</details>

---

## 🛠️ Methodology

- **Scoring:** Partial credit based on line overlap (0-10 per question)
- **PURE Engines:** Use only universal programming synonyms, no test-file-specific keywords
- **Biased Engines:** May contain keywords tuned to specific test files
- **Fair Comparison:** All engines tested on same questions with identical ground truth

---

*Generated by Comprehensive Benchmark Suite*
`;

  fs.writeFileSync('BENCHMARK_RESULTS.md', md);
  console.log('✔ Markdown report saved to BENCHMARK_RESULTS.md');
}

// Run the benchmark
runComprehensiveBenchmark().catch(console.error);
