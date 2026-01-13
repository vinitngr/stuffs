const bm25 = require('wink-bm25-text-search');
const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const { fuzzy } = require('fast-fuzzy');

const nlp = winkNLP(model);
const its = nlp.its;

function prep(text) {
  return nlp.readDoc(text)
    .tokens()
    .filter(t => t.out(its.type) === 'word')
    .out(its.normal);
}

function normalizeMap(map) {
  const values = Object.values(map);
  const max = Math.max(...values, 1e-6);
  const min = Math.min(...values);

  return Object.fromEntries(
    Object.entries(map).map(([id, score]) => [
      id,
      (score - min) / (max - min || 1)
    ])
  );
}

function buildBM25(docs) {
  const engine = bm25();

  engine.defineConfig({
    fldWeights: { body: 1 },
    bm25Params: { k1: 1.2, b: 0.75 }
  });

  engine.definePrepTasks([ prep ]);

  for (const doc of docs) {
    engine.addDoc({ body: doc.body }, doc.id);
  }

  engine.consolidate();
  return engine;
}

function rerank({ query, vectorResults }) {
  const engine = buildBM25(vectorResults);

  const bm25Results = engine.search(query);

  const rawBM25 = Object.fromEntries(
    bm25Results.map(([id, score]) => [id, score])
  );

  const bm25Norm = normalizeMap(rawBM25);

  return vectorResults
    .map(doc => {
      const fuzzyScore =
        query.length < 120 ? fuzzy(query, doc.body) : 0;

      const finalScore =
        0.80 * doc.vectorScore +
        0.15 * (bm25Norm[doc.id] || 0) +
        0.05 * fuzzyScore;

      return {
        ...doc,
        bm25Norm: bm25Norm[doc.id] || 0,
        fuzzyScore,
        finalScore
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

const query = `
github pr context missing in rag pipeline
`;

const vectorResults = [
  {
    id: 101,
    body: `
    Design document describing the unified context ingestion pipeline
    that connects GitHub repositories, pull requests, issues, Slack conversations,
    and Notion pages into a single retrieval augmented generation system.
    `,
    vectorScore: 0.91
  },
  {
    id: 102,
    body: `
    GitHub issue discussing missing pull request review comments in the RAG pipeline.
    Root cause analysis shows Slack threads were not indexed during incident ingestion.
    `,
    vectorScore: 0.88
  },
  {
    id: 103,
    body: `
    Slack incident postmortem describing missing GitHub context during
    production outage analysis and limitations of retrieval coverage.
    `,
    vectorScore: 0.84
  },
  {
    id: 104,
    body: `
    Pull request adding indexing support for GitHub issue comments and
    pull request reviews in the context engine embedding pipeline.
    `,
    vectorScore: 0.86
  },
  {
    id: 105,
    body: `
    Notion documentation outlining how internal knowledge from Slack,
    GitHub, and Notion is aggregated for retrieval augmented generation.
    `,
    vectorScore: 0.83
  },
  {
    id: 106,
    body: `
    Engineering RFC proposing improvements to ranking and recall when
    combining Slack conversations with GitHub issues for RAG.
    `,
    vectorScore: 0.82
  },
  {
    id: 107,
    body: `
    High-level overview of retrieval augmented generation architectures
    without reference to internal tooling integrations.
    `,
    vectorScore: 0.74
  },
  {
    id: 108,
    body: `
    Documentation for the search service describing BM25 scoring,
    fuzzy matching, and hybrid reranking strategies.
    `,
    vectorScore: 0.71
  }
];

const results = rerank({ query, vectorResults });

results.forEach(r => {
  console.log(
    `id=${r.id}`,
    'final=', r.finalScore.toFixed(4),
    'vector=', r.vectorScore.toFixed(2),
    'bm25Norm=', r.bm25Norm.toFixed(4),
    'fuzzy=', r.fuzzyScore.toFixed(4)
  );
});
