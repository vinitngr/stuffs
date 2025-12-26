const acorn = require('acorn');
const walk = require('acorn-walk');
const bm25 = require('wink-bm25-text-search');
const nlp = require('wink-nlp-utils');
const natural = require('natural');
const _ = require('lodash');

const stemmer = natural.PorterStemmer;
const tokenizer = new natural.WordTokenizer();

// ============== TEXT PROCESSING ==============

// Split camelCase, PascalCase, snake_case, kebab-case into words
function splitIdentifier(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-\.]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Extract comments from code (single-line and multi-line)
function extractComments(code) {
  const comments = [];
  const lines = code.split('\n');
  
  // Single line comments
  const singleLineRegex = /\/\/\s*(.+)$/;
  
  lines.forEach((line, idx) => {
    const match = line.match(singleLineRegex);
    if (match) {
      comments.push({ text: match[1], line: idx + 1 });
    }
  });
  
  // Multi-line comments with line tracking
  let match;
  const multiRe = /\/\*[\s\S]*?\*\//g;
  while ((match = multiRe.exec(code)) !== null) {
    const beforeMatch = code.slice(0, match.index);
    const lineNum = beforeMatch.split('\n').length;
    const text = match[0].replace(/\/\*|\*\//g, '').replace(/\s*\*\s*/g, ' ').trim();
    comments.push({ text, line: lineNum });
  }
  
  return comments;
}

// ============== AST EXTRACTION ==============

function extractASTInfo(ast) {
  const regions = [];
  const identifiers = [];
  const strings = [];
  const callExpressions = [];
  
  walk.simple(ast, {
    FunctionDeclaration(node) {
      regions.push({
        start: node.loc.start.line,
        end: node.loc.end.line,
        type: 'function',
        name: node.id ? node.id.name : null
      });
    },
    FunctionExpression(node) {
      regions.push({
        start: node.loc.start.line,
        end: node.loc.end.line,
        type: 'function',
        name: node.id ? node.id.name : null
      });
    },
    ArrowFunctionExpression(node) {
      regions.push({
        start: node.loc.start.line,
        end: node.loc.end.line,
        type: 'arrow'
      });
    },
    ClassDeclaration(node) {
      regions.push({
        start: node.loc.start.line,
        end: node.loc.end.line,
        type: 'class',
        name: node.id ? node.id.name : null
      });
    },
    MethodDefinition(node) {
      regions.push({
        start: node.loc.start.line,
        end: node.loc.end.line,
        type: 'method',
        name: node.key && node.key.name ? node.key.name : null
      });
    },
    Identifier(node) {
      identifiers.push({
        name: node.name,
        line: node.loc.start.line,
        parts: splitIdentifier(node.name)
      });
    },
    Literal(node) {
      if (typeof node.value === 'string' && node.value.length > 2) {
        strings.push({ value: node.value, line: node.loc.start.line });
      }
    },
    TemplateLiteral(node) {
      node.quasis.forEach(q => {
        if (q.value.cooked && q.value.cooked.length > 2) {
          strings.push({ value: q.value.cooked, line: node.loc.start.line });
        }
      });
    },
    CallExpression(node) {
      if (node.callee) {
        let callName = '';
        if (node.callee.type === 'Identifier') {
          callName = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          if (node.callee.property && node.callee.property.name) {
            callName = node.callee.property.name;
          }
        }
        if (callName) {
          callExpressions.push({ name: callName, line: node.loc.start.line });
        }
      }
    }
  });
  
  return { regions, identifiers, strings, callExpressions };
}

// ============== QUERY PROCESSING ==============

// Expand query with stemmed variants
function processQuery(query) {
  const lower = query.toLowerCase();
  const tokens = tokenizer.tokenize(lower).filter(t => t.length > 2);
  const stems = tokens.map(t => stemmer.stem(t));
  
  // Also split any camelCase/snake_case in query
  const expanded = [];
  tokens.forEach(t => {
    expanded.push(t);
    expanded.push(...splitIdentifier(t));
  });
  
  return {
    original: query,
    tokens: [...new Set(tokens)],
    stems: [...new Set(stems)],
    expanded: [...new Set(expanded.filter(w => w.length > 2))]
  };
}

// ============== SCORING FUNCTIONS ==============

// Score based on identifier matches (function names, variable names, etc.)
function scoreIdentifiers(windowIds, queryInfo) {
  let score = 0;
  const matched = new Set();
  
  for (const id of windowIds) {
    const idLower = id.name.toLowerCase();
    const idStem = stemmer.stem(idLower);
    
    // Check against query tokens
    for (const token of queryInfo.tokens) {
      const tokenStem = stemmer.stem(token);
      
      // Direct match
      if (idLower === token) {
        score += 0.15;
        matched.add(token);
      }
      // Stem match
      else if (idStem === tokenStem) {
        score += 0.1;
        matched.add(token);
      }
      // Substring match
      else if (idLower.includes(token) && token.length > 3) {
        score += 0.08;
        matched.add(token);
      }
      // Jaro-Winkler similarity for typos/variants
      else if (token.length > 3 && natural.JaroWinklerDistance(idLower, token) > 0.9) {
        score += 0.06;
        matched.add(token);
      }
    }
    
    // Check identifier parts against query
    for (const part of id.parts) {
      const partStem = stemmer.stem(part);
      for (const token of queryInfo.tokens) {
        const tokenStem = stemmer.stem(token);
        if (part === token || partStem === tokenStem) {
          score += 0.07;
          matched.add(token);
        }
      }
    }
  }
  
  // Coverage bonus - what fraction of query tokens matched
  const coverage = matched.size / Math.max(queryInfo.tokens.length, 1);
  score += coverage * 0.1;
  
  return Math.min(score, 0.5);
}

// Score based on comment relevance
function scoreComments(windowComments, queryInfo, textLower) {
  let score = 0;
  
  for (const comment of windowComments) {
    const commentLower = comment.text.toLowerCase();
    const commentTokens = tokenizer.tokenize(commentLower);
    
    for (const token of queryInfo.tokens) {
      if (commentLower.includes(token)) {
        score += 0.1;
      }
      // Stem matching in comments
      const tokenStem = stemmer.stem(token);
      for (const ct of commentTokens) {
        if (stemmer.stem(ct) === tokenStem) {
          score += 0.05;
        }
      }
    }
  }
  
  return Math.min(score, 0.3);
}

// Score based on code structure (functions, classes containing query concepts)
function scoreStructure(regions, windowStart, windowEnd, queryInfo) {
  let score = 0;
  
  const containedRegions = regions.filter(r => 
    r.start >= windowStart && r.end <= windowEnd
  );
  
  const overlappingRegions = regions.filter(r =>
    !(r.end < windowStart || r.start > windowEnd)
  );
  
  // Bonus for containing complete structures
  if (containedRegions.length > 0) {
    score += 0.08;
  }
  
  // Check if region names match query
  for (const region of overlappingRegions) {
    if (region.name) {
      const nameParts = splitIdentifier(region.name);
      for (const token of queryInfo.tokens) {
        const tokenStem = stemmer.stem(token);
        for (const part of nameParts) {
          if (part === token || stemmer.stem(part) === tokenStem) {
            score += 0.12;
          }
        }
      }
    }
  }
  
  return Math.min(score, 0.35);
}

// Score term proximity - how close query terms appear to each other
function scoreProximity(textLower, queryInfo) {
  if (queryInfo.tokens.length < 2) return 0;
  
  const positions = [];
  for (const token of queryInfo.tokens) {
    let idx = textLower.indexOf(token);
    while (idx !== -1) {
      positions.push({ token, pos: idx });
      idx = textLower.indexOf(token, idx + 1);
    }
  }
  
  if (positions.length < 2) return 0;
  
  positions.sort((a, b) => a.pos - b.pos);
  
  // Calculate average distance between consecutive different tokens
  let totalDist = 0;
  let pairs = 0;
  
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].token !== positions[i-1].token) {
      totalDist += positions[i].pos - positions[i-1].pos;
      pairs++;
    }
  }
  
  if (pairs === 0) return 0;
  
  const avgDist = totalDist / pairs;
  // Normalize: closer = higher score
  return Math.max(0, 1 - avgDist / 300) * 0.15;
}

// ============== MAIN SEARCH FUNCTION ==============

function search(code, query, opts = {}) {
  const {
    topK = 3,
    minLines = 5,
    maxLines = 80,
    windowStep = 4,
  } = opts;

  const lines = code.split('\n');
  const queryInfo = processQuery(query);
  const comments = extractComments(code);

  // Parse AST
  let astInfo = { regions: [], identifiers: [], strings: [], callExpressions: [] };
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    });
    astInfo = extractASTInfo(ast);
  } catch {}

  // Generate sliding windows
  const windows = [];
  for (let i = 0; i < lines.length; i += windowStep) {
    const start = i + 1;
    const end = Math.min(lines.length, start + maxLines - 1);
    if (end - start + 1 >= minLines) {
      const text = lines.slice(start - 1, end).join('\n');
      windows.push({ start, end, size: end - start + 1, text, textLower: text.toLowerCase() });
    }
  }

  // ===== BM25 Scoring (fast) =====
  const bm25Engine = bm25();
  bm25Engine.defineConfig({ fldWeights: { body: 1 } });
  bm25Engine.definePrepTasks([
    nlp.string.lowerCase,
    nlp.string.tokenize0,
    nlp.tokens.removeWords,
    nlp.tokens.stem
  ]);
  
  windows.forEach((w, i) => bm25Engine.addDoc({ body: w.text }, i));
  bm25Engine.consolidate();
  
  const bm25Scores = bm25Engine.search(query);
  const maxBm25 = bm25Scores.length > 0 ? Math.max(...bm25Scores.map(r => r[1])) : 1;

  // ===== Score Each Window =====
  const scored = windows.map((w, i) => {
    const textLower = w.textLower;
    
    // 1. BM25 score (normalized)
    const bm25Result = bm25Scores.find(r => r[0] === i);
    const bm25Score = bm25Result ? bm25Result[1] / Math.max(maxBm25, 1) : 0;
    
    // 2. Identifier matching score
    const windowIds = astInfo.identifiers.filter(
      id => id.line >= w.start && id.line <= w.end
    );
    const idScore = scoreIdentifiers(windowIds, queryInfo);
    
    // 3. Comment relevance score
    const windowComments = comments.filter(
      c => c.line >= w.start && c.line <= w.end
    );
    const commentScore = scoreComments(windowComments, queryInfo, textLower);
    
    // 4. Code structure score
    const structureScore = scoreStructure(
      astInfo.regions, w.start, w.end, queryInfo
    );
    
    // 5. Term proximity score
    const proximityScore = scoreProximity(textLower, queryInfo);
    
    // 6. Token coverage - what fraction of query tokens found
    const foundTokens = queryInfo.tokens.filter(t => textLower.includes(t));
    const coverageScore = foundTokens.length / Math.max(queryInfo.tokens.length, 1) * 0.2;
    
    // 7. Stem coverage - using stemmed matching
    const textWords = textLower.split(/\W+/);
    const textStems = new Set(textWords.map(w => stemmer.stem(w)));
    const foundStems = queryInfo.stems.filter(s => textStems.has(s));
    const stemCoverageScore = foundStems.length / Math.max(queryInfo.stems.length, 1) * 0.15;

    // Combined score with weights
    const score =
      bm25Score * 0.35 +
      idScore +
      commentScore +
      structureScore +
      proximityScore +
      coverageScore +
      stemCoverageScore;

    return { start: w.start, end: w.end, score, size: w.size };
  });

  // Deduplicate overlapping windows
  const sorted = _.orderBy(scored, ['score'], ['desc']);
  const selected = [];
  
  for (const candidate of sorted) {
    if (selected.length >= topK) break;
    
    const hasSignificantOverlap = selected.some(s => {
      const overlapStart = Math.max(s.start, candidate.start);
      const overlapEnd = Math.min(s.end, candidate.end);
      const overlap = Math.max(0, overlapEnd - overlapStart + 1);
      const candidateSize = candidate.end - candidate.start + 1;
      return overlap / candidateSize > 0.5;
    });
    
    if (!hasSignificantOverlap) {
      selected.push(candidate);
    }
  }

  return selected.map(r => ({
    start: r.start,
    end: r.end,
    score: Number(r.score.toFixed(4))
  }));
}


if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🎯 THE CHOSEN ONE - Configurable Code Search Engine

Usage:
  node search_engine.js <file.js> "<query>" [options]

Options:
  --min <n>      Minimum lines per result (default: 30)
  --max <n>      Maximum lines per result (default: 200)
  --topK <n>     Number of results (default: 5)
  --no-expand    Disable smart function expansion

Examples:
  node search_engine.js ../test.file.js "where is retry logic"
  node search_engine.js ../test.file.js "cache implementation" --min 50 --max 150 --topK 3
`);
    process.exit(1);
  }
  
  const filePath = args[0];
  const query = args[1];
  
  // Parse options
  const config = {};
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--min' && args[i + 1]) config.minLines = parseInt(args[++i]);
    if (args[i] === '--max' && args[i + 1]) config.maxLines = parseInt(args[++i]);
    if (args[i] === '--topK' && args[i + 1]) config.topK = parseInt(args[++i]);
    if (args[i] === '--no-expand') config.smartExpand = false;
  }
  
  search(filePath, query, config);
}

module.exports = { search };

