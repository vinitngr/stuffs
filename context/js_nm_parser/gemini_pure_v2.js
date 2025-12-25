const { parse } = require('acorn');

function functionNameYouGive(code, query) {
  // Minimal Stop Words for BM25
  const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  const stem = (word) => {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('tion')) return word.slice(0, -4); // Added tion
    return word;
  };

  const tokenize = (text) => {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOP_WORDS.has(t)) // Allow 2-letter words like 'id', 'db'
      .map(stem);
  };

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return Array(5).fill({ start: 1, end: 2, score: 0 });

  let ast;
  try {
    ast = parse(code, { locations: true, ecmaVersion: 'latest', sourceType: 'module', onComment: [] });
  } catch (e) {
    try { ast = parse(code, { locations: true, ecmaVersion: 'latest', sourceType: 'script' }); } 
    catch (e2) { return fallbackSearch(code, new Set(queryTokens)); }
  }

  // --- BM25 PRE-CALCULATION ---
  const documents = []; 
  const docFrequencies = {}; 
  let totalDocLength = 0;

  const getText = (node) => {
    const lines = code.split('\n').slice(node.loc.start.line - 1, node.loc.end.line);
    return lines.join(' ');
  };

  const collectDocuments = (node, parent) => {
    if (!node) return;

    const isFunction = /Function|Method/.test(node.type);
    const isClass = node.type === 'ClassDeclaration';
    const isTopLevel = parent && parent.type === 'Program';
    const isStatement = node.type === 'ExpressionStatement' || node.type === 'VariableDeclaration';
    const isObjectProperty = node.type === 'Property' && (node.loc.end.line - node.loc.start.line > 2);
    const isSetInterval = node.type === 'CallExpression' && node.callee && node.callee.name === 'setInterval';

    if (isFunction || isClass || (isTopLevel && isStatement) || isObjectProperty || isSetInterval) {
      const nodeText = getText(node);
      const nodeTokens = tokenize(nodeText);
      
      if (nodeTokens.length > 0) {
        const uniqueTokens = new Set(nodeTokens);
        uniqueTokens.forEach(t => {
          docFrequencies[t] = (docFrequencies[t] || 0) + 1;
        });
        
        documents.push({
          node: node,
          tokens: nodeTokens,
          length: nodeTokens.length,
          text: nodeText,
          isFunction, isClass, isTopLevel, isStatement, isObjectProperty, isSetInterval
        });
        totalDocLength += nodeTokens.length;
      }
    }

    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) node[key].forEach(child => collectDocuments(child, node));
        else if (node[key].type) collectDocuments(node[key], node);
      }
    }
  };

  collectDocuments(ast, null);

  const avgDocLength = totalDocLength / (documents.length || 1);
  const N = documents.length;
  const k1 = 1.2; // Standard BM25
  const b = 0.75;

  const candidates = [];

  documents.forEach(doc => {
    let score = 0;
    const docTokenCounts = {};
    doc.tokens.forEach(t => docTokenCounts[t] = (docTokenCounts[t] || 0) + 1);

    queryTokens.forEach(qt => {
      // Exact Match
      if (docTokenCounts[qt]) {
        const tf = docTokenCounts[qt];
        const df = docFrequencies[qt] || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const termScore = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / avgDocLength))));
        score += termScore;
      } 
      // Substring/Prefix Match
      else {
         let subMatchCount = 0;
         let isPrefix = false;
         doc.tokens.forEach(dt => {
            if (dt.includes(qt) || qt.includes(dt)) {
                subMatchCount++;
                if (dt.startsWith(qt) || qt.startsWith(dt)) isPrefix = true;
            }
         });
         if (subMatchCount > 0) {
            const tf = subMatchCount;
            const df = 1; // Assume rare
            const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
            let termScore = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / avgDocLength))));
            
            // Boost for prefix match (e.g. auth -> authorization)
            const weight = isPrefix ? 0.8 : 0.5; 
            score += termScore * weight;
         }
      }
    });

    if (score > 0) {
        // Name extraction & Boost
        let name = "";
        const node = doc.node;
        if (node.id && node.id.name) name = node.id.name;
        else if (node.key && node.key.name) name = node.key.name;
        else if (node.type === 'VariableDeclaration' && node.declarations && node.declarations[0].id.name) {
           name = node.declarations[0].id.name;
        } else if (doc.isSetInterval) {
           name = "setInterval";
        }

        if (name) {
          const nameTokens = tokenize(name);
          nameTokens.forEach(nt => {
            // Exact name match
            if (queryTokens.includes(nt)) score += 5; 
            // Substring name match
            else {
                queryTokens.forEach(qt => {
                    if (nt.includes(qt) || qt.includes(nt)) score += 3;
                });
            }
          });
        }

        // Structural Multipliers
        if (doc.isFunction) score *= 1.5;
        if (doc.isClass) score *= 1.2;
        if (doc.isTopLevel && doc.isStatement) score *= 1.1;
        if (doc.isObjectProperty) score *= 1.1;
        if (doc.isSetInterval) score *= 1.5;

        // Specific pattern boost
        if (doc.text.includes('process.on')) score *= 1.5; 
        if (doc.text.includes('setInterval')) score *= 1.2; 

        candidates.push({
          start: node.loc.start.line,
          end: node.loc.end.line,
          score: score,
          type: node.type
        });
    }
  });

  const fallbackCandidates = fallbackSearch(code, new Set(queryTokens));
  const allCandidates = [...candidates, ...fallbackCandidates];

  allCandidates.sort((a, b) => b.score - a.score);

  const finalResults = [];
  const covered = new Set();
  const PADDING = 4; 

  for (const cand of allCandidates) {
    if (finalResults.length >= 5) break;

    let isCovered = false;
    for (let i = cand.start; i <= cand.end; i++) {
      if (covered.has(i)) {
        isCovered = true; 
        break;
      }
    }

    if (!isCovered) {
      const totalLines = code.split('\n').length;
      const start = Math.max(1, cand.start - PADDING);
      const end = Math.min(totalLines, cand.end + PADDING);

      finalResults.push({ start: start, end: end, score: cand.score });
      for (let i = start; i <= end; i++) covered.add(i);
    }
  }

  while (finalResults.length < 5) {
    finalResults.push({ start: 1, end: 2, score: 0 });
  }

  return finalResults;
}

function fallbackSearch(code, expandedTokens) {
    const lines = code.split('\n');
    const scores = lines.map((line, i) => {
        let score = 0;
        const lower = line.toLowerCase();
        expandedTokens.forEach(t => {
            if (lower.includes(t)) score += 2; 
        });
        if (score > 0 && (line.includes('=') || line.includes('function') || line.includes('class'))) {
            score *= 1.2;
        }
        return { start: i + 1, end: i + 1, score: score, type: 'line' };
    });
    return scores.filter(s => s.score > 0);
}

module.exports = { functionNameYouGive };
