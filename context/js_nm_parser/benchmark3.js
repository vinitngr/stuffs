const fs = require('fs');
const Table = require('cli-table3');

let chalk;
try {
  chalk = require('chalk');
} catch {
  chalk = {
    cyan: t => t,
    green: t => t,
    red: t => t,
    yellow: t => t,
    bold: t => t,
    gray: t => t
  };
}

const { functionNameYouGive: geminiFn } = require('./gemini.js');
const { functionNameYouGive: gptFn } = require('./gpt.js');
const { findTopRelevantLineRangesClaude: claudeFn } = require('./claude.js');
const { findTopRelevantLineRanges: dsFn } = require('./deepseek.js');

const BENCHMARKS = [
  { query: "How is cache expiry calculated when setting a value?", truth: { start: 16, end: 20 }, description: "Cache Set Logic" },
  { query: "Where is the cache cleanup scheduled?", truth: { start: 37, end: 44 }, description: "Cache Cleanup Schedule" },
  { query: "How does the cache handle expired items during retrieval?", truth: { start: 28, end: 32 }, description: "Cache Get Expiry" },
  
  { query: "How are tokens refilled in the rate limiter?", truth: { start: 75, end: 83 }, description: "Rate Limiter Refill" },
  { query: "Where is the token consumption logic?", truth: { start: 85, end: 101 }, description: "Rate Limiter Consume" },
  { query: "How does the system check if a client is blocked?", truth: { start: 107, end: 114 }, description: "Rate Limiter Block Check" },

  { query: "How are requests logged with rotation?", truth: { start: 129, end: 148 }, description: "Request Logging" },
  { query: "Where does log rotation happen?", truth: { start: 150, end: 155 }, description: "Log Rotation Logic" },
  { query: "How can logs be searched with filters?", truth: { start: 166, end: 174 }, description: "Log Search" },

  { query: "How is middleware executed recursively?", truth: { start: 195, end: 207 }, description: "Middleware Execution" },
  { query: "Where are requests matched to routes?", truth: { start: 209, end: 224 }, description: "Route Handling" },
  { query: "How are new routes added to the router?", truth: { start: 183, end: 186 }, description: "Add Route Logic" },

  { query: "Where is the request body parsed from the stream?", truth: { start: 238, end: 251 }, description: "Body Parsing" },
  { query: "How is the authorization header validated?", truth: { start: 256, end: 270 }, description: "Auth Middleware" }
];

const TEST_FILE = 'test2.file.js';
const OUTPUT_JSON = 'benchmark3_results.json';

function overlapLines(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start) + 1);
}

function calculateMarks(result, truth) {
  if (!result || result.start === 0) return 0;
  const overlap = overlapLines(result, truth);
  const truthSize = truth.end - truth.start + 1;
  return overlap === 0 ? 0 : (overlap / truthSize) * 10;
}

async function runBenchmark() {
  if (!fs.existsSync(TEST_FILE)) {
    console.error(`Error: ${TEST_FILE} not found.`);
    return;
  }

  const code = fs.readFileSync(TEST_FILE, 'utf-8');

  const engines = [
    { name: 'Gemini-3.0-pro', fn: geminiFn },
    { name: 'GPT-5.1-codex-max', fn: gptFn },
    { name: 'Claude-Opus-4.5', fn: claudeFn },
  ];

  const jsonReport = {
    meta: {
      file: TEST_FILE,
      totalQuestions: BENCHMARKS.length,
      maxScore: BENCHMARKS.length * 10
    },
    questions: [],
    finalScores: {}
  };

  console.log(chalk.bold.cyan('\n Line-Overlap Benchmark 3 (New Test File)\n'));

  const table = new Table({
    head: [chalk.bold('Engine'), chalk.bold('Top Result'), chalk.bold('Overlap Lines'), chalk.bold('Marks / 10')],
    colWidths: [15, 20, 18, 15]
  });

  const scores = {};
  engines.forEach(e => scores[e.name] = 0);

  for (let i = 0; i < BENCHMARKS.length; i++) {
    const { query, truth, description } = BENCHMARKS[i];
    console.log(chalk.yellow(`Q${i + 1}: ${description}`));
    console.log(chalk.gray(`Query: "${query}"`));
    console.log(chalk.gray(`Truth: L${truth.start}-${truth.end}`));

    const questionResult = {
      id: i + 1,
      query,
      truth,
      results: {}
    };

    const questionTable = new Table({
      head: ['Engine', 'Top Result', 'Overlap Lines', 'Marks / 10'],
      colWidths: [15, 20, 18, 15]
    });

    for (const engine of engines) {
      try {
        const results = await engine.fn(code, query);
        const topResult = results[0] || { start: 0, end: 0 };
        
        const marks = calculateMarks(topResult, truth);
        scores[engine.name] += marks;

        const overlap = overlapLines(topResult, truth);
        
        questionTable.push([
          engine.name,
          `L${topResult.start}-${topResult.end}`,
          overlap.toString(),
          marks.toFixed(2)
        ]);

        questionResult.results[engine.name] = {
          range: topResult,
          overlap,
          marks
        };

      } catch (err) {
        console.error(chalk.red(`Error in ${engine.name}:`), err.message);
        questionTable.push([engine.name, 'ERROR', '0', '0.00']);
      }
    }

    console.log(questionTable.toString());
    console.log('');
    jsonReport.questions.push(questionResult);
  }

  console.log(chalk.bold.cyan('\n FINAL STANDINGS (Max ' + (BENCHMARKS.length * 10) + ')\n'));

  const finalTable = new Table({
    head: ['Rank', 'Engine', 'Total Marks', 'Accuracy'],
    colWidths: [10, 18, 18, 18]
  });

  const sortedEngines = Object.entries(scores).sort(([, a], [, b]) => b - a);

  sortedEngines.forEach(([name, score], index) => {
    const accuracy = ((score / (BENCHMARKS.length * 10)) * 100).toFixed(1) + '%';
    finalTable.push([`#${index + 1}`, name, score.toFixed(2), accuracy]);
    jsonReport.finalScores[name] = { score, accuracy };
  });

  console.log(finalTable.toString());

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonReport, null, 2));
  console.log(chalk.green(`\n✔ JSON report written to ${OUTPUT_JSON}`));
}

runBenchmark();
