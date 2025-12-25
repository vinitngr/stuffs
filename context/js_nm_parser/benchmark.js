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

const TEST_FILE = 'test.file.js';
const OUTPUT_JSON = 'benchmark_results.json';

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
    console.error('Error: test.file.js not found.');
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

  console.log('\n📐 Line-Overlap Benchmark (Partial Credit Enabled)\n');

  const finalScores = {};
  engines.forEach(e => finalScores[e.name] = 0);

  BENCHMARKS.forEach((bench, idx) => {
    console.log(chalk.bold(`Q${idx + 1}: ${bench.description}`));
    console.log(chalk.gray(`Query: "${bench.query}"`));
    console.log(chalk.yellow(`Truth: L${bench.truth.start}-${bench.truth.end}`));

    const table = new Table({
      head: ['Engine', 'Top Result', 'Overlap Lines', 'Marks / 10'],
      colWidths: [12, 18, 16, 14]
    });

    const questionEntry = {
      id: idx + 1,
      query: bench.query,
      description: bench.description,
      truth: bench.truth,
      results: {}
    };

    engines.forEach(engine => {
      let top = { start: 0, end: 0 };

      try {
        const results = engine.fn(code, bench.query);
        if (results && results.length > 0) top = results[0];
      } catch {}

      const overlap = overlapLines(top, bench.truth);
      const marks = calculateMarks(top, bench.truth);
      finalScores[engine.name] += marks;

      questionEntry.results[engine.name] = {
        predicted: top.start ? { start: top.start, end: top.end } : null,
        overlapLines: overlap,
        marks: Number(marks.toFixed(2))
      };

      table.push([
        engine.name,
        top.start ? `L${top.start}-${top.end}` : '-',
        overlap,
        marks.toFixed(2)
      ]);
    });

    jsonReport.questions.push(questionEntry);
    console.log(table.toString());
    console.log('');
  });

  const MAX_SCORE = BENCHMARKS.length * 10;

  console.log(chalk.bold.cyan(`\n🏆 FINAL STANDINGS (Max ${MAX_SCORE})\n`));

  const ranking = new Table({
    head: ['Rank', 'Engine', 'Total Marks', 'Accuracy'],
    colWidths: [8, 15, 15, 15]
  });

  Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .forEach(([name, score], i) => {
      const accuracy = (score / MAX_SCORE) * 100;
      ranking.push([
        `#${i + 1}`,
        name,
        score.toFixed(2),
        `${accuracy.toFixed(1)}%`
      ]);
      jsonReport.finalScores[name] = {
        score: Number(score.toFixed(2)),
        accuracy: Number(accuracy.toFixed(2))
      };
    });

  console.log(ranking.toString());

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonReport, null, 2));
  console.log(chalk.green(`\n✔ JSON report written to ${OUTPUT_JSON}\n`));
}

runBenchmark().catch(console.error);
