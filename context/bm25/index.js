const bm25 = require('wink-bm25-text-search');
const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');

// -----------------------------
// NLP SETUP
// -----------------------------
const nlp = winkNLP(model);
const its = nlp.its;

// -----------------------------
// BM25 ENGINE
// -----------------------------
const engine = bm25();

engine.defineConfig({
  fldWeights: { body: 1 },
  bm25Params: { k1: 1.2, b: 0.75 }
});

engine.definePrepTasks([
  text => nlp.readDoc(text).tokens().out(its.normal)
]);

// -----------------------------
// ADD DOCUMENTS
// 🔴 ID IS SECOND ARG
// -----------------------------
engine.addDoc(
  { body: 'BM25 search engine written in JavaScript' },
  1
);

engine.addDoc(
  { body: 'Node based text search with ranking' },
  2
);

engine.addDoc(
  { body: 'Simple search engine implementation' },
  3
);

engine.addDoc(
  { body: 'Retrieval augmented generation pipeline using BM25' },
  4
);

// finalize index
engine.consolidate();

// -----------------------------
// SEARCH
// -----------------------------
function search(query) {
  return engine.search(query).map(([id, score]) => ({
    id,
    score: Number(score.toFixed(4))
  }));
}

// -----------------------------
// TEST
// -----------------------------
console.log(
  search('searchh Engine!')
);
