const fs = require('fs');
const path = require('path');

const INPUT = 'benchmark_results.json';
const OUTPUT_DIR = 'models';

if (!fs.existsSync(INPUT)) {
  console.error('benchmark_results.json not found');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const modelBuckets = {};

raw.questions.forEach(q => {
  Object.entries(q.results).forEach(([model, result]) => {
    if (!modelBuckets[model]) {
      modelBuckets[model] = {
        meta: {
          model,
          sourceFile: raw.meta.file,
          totalQuestions: raw.meta.totalQuestions,
          maxScore: raw.meta.maxScore
        },
        questions: [],
        finalScore: null
      };
    }

    modelBuckets[model].questions.push({
      id: q.id,
      query: q.query,
      description: q.description,
      truth: q.truth,
      predicted: result.predicted,
      overlapLines: result.overlapLines,
      marks: result.marks
    });
  });
});

Object.entries(modelBuckets).forEach(([model, data]) => {
  if (raw.finalScores[model]) {
    data.finalScore = raw.finalScores[model];
  }

  const safeName = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outFile = path.join(OUTPUT_DIR, `benchmark-${safeName}.json`);

  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✔ wrote ${outFile}`);
});
