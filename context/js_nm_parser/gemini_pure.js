const { parse } = require('acorn');

function functionNameYouGive(code, query) {
  const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'to', 'of', 'for', 'with', 'on', 'at', 'by', 'from', 'is', 'it', 'this', 'that', 'var', 'let', 'const', 'function', 'return', 'if', 'else', 'true', 'false', 'null', 'undefined', 'class', 'new', 'export', 'import', 'async', 'await', 'console', 'log', 'how', 'where', 'what', 'does', 'are', 'which', 'when', 'why', 'do', 'can', 'will', 'be', 'system']);

  // NO SYNONYMS - Pure Keyword Matching
  // This relies solely on the tokens present in the query and the code.

  const stem = (word) => {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('ed')) return word.slice(0, -2);
    return word;
  };

  const tokenize = (text) => {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t))
      .map(stem);
  };

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return Array(5).fill({ start: 1, end: 2, score: 0 });

  // No expansion
  const expandedQueryTokens = new Set(queryTokens);

  let ast;
  try {
    ast = parse(code, { locations: true, ecmaVersion: 'latest', sourceType: 'module', onComment: [] });
  } catch (e) {
    try { ast = parse(code, { locations: true, ecmaVersion: 'latest', sourceType: 'script' }); } 
    catch (e2) { return fallbackSearch(code, expandedQueryTokens); }
  }

  const candidates = [];
  
  const getText = (node) => {
    const lines = code.split('\n').slice(node.loc.start.line - 1, node.loc.end.line);
    return lines.join(' ');
  };

  const traverse = (node, parent) => {
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
      
      let matches = 0;
      const uniqueMatches = new Set();
      
      nodeTokens.forEach(t => {
        if (expandedQueryTokens.has(t)) {
          matches++;
          uniqueMatches.add(t);
        }
      });

      // Substring matching for pure keyword approach
      queryTokens.forEach(qt => {
        nodeTokens.forEach(nt => {
          if (!uniqueMatches.has(qt) && (nt.includes(qt) || qt.includes(nt)) && nt !== qt) {
            matches += 0.5; // Lower weight for substring
            uniqueMatches.add(qt);
          }
        });
      });

      if (matches > 0) {
        // Scoring logic adapted for pure keywords
        // Higher weight for matches since we don't have synonyms
        let score = matches * 2.0 + uniqueMatches.size * 10.0;

        // Name extraction
        let name = "";
        if (node.id && node.id.name) name = node.id.name;
        else if (node.key && node.key.name) name = node.key.name;
        else if (node.type === 'VariableDeclaration' && node.declarations && node.declarations[0].id.name) {
           name = node.declarations[0].id.name;
        } else if (isSetInterval) {
           name = "setInterval";
        }

        if (name) {
          const nameTokens = tokenize(name);
          nameTokens.forEach(nt => {
            if (queryTokens.includes(nt)) score += 50; // High boost for name match
          });
        }

        // Structural boosts
        if (isFunction) score *= 2.0;
        if (isClass) score *= 1.5;
        if (isTopLevel && isStatement) score *= 1.5;
        if (isObjectProperty) score *= 1.4;
        if (isSetInterval) score *= 2.0;

        // Size penalty
        const size = node.loc.end.line - node.loc.start.line + 1;
        if (size <= 3) score *= 0.3;

        // Specific pattern boost (kept generic)
        if (nodeText.includes('process.on')) score *= 2.0; 
        if (nodeText.includes('setInterval')) score *= 1.5; 

        candidates.push({
          start: node.loc.start.line,
          end: node.loc.end.line,
          score: score,
          type: node.type
        });
      }
    }

    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) node[key].forEach(child => traverse(child, node));
        else if (node[key].type) traverse(node[key], node);
      }
    }
  };

  traverse(ast, null);

  const fallbackCandidates = fallbackSearch(code, expandedQueryTokens);
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
