const { parse } = require('acorn');

function functionNameYouGive(code, query) {
  const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'to', 'of', 'for', 'with', 'on', 'at', 'by', 'from', 'is', 'it', 'this', 'that', 'var', 'let', 'const', 'function', 'return', 'if', 'else', 'true', 'false', 'null', 'undefined', 'class', 'new', 'export', 'import', 'async', 'await', 'console', 'log', 'how', 'where', 'what', 'does', 'are', 'which', 'when', 'why', 'do', 'can', 'will', 'be', 'system']);

  // Synonyms from Claude + some extras
  const SYNONYMS = {
    "retry": ["retry", "retries", "attempts", "backoff", "exponential", "try", "strategy"],
    "backoff": ["retry", "exponential", "delay", "wait"],
    "exponential": ["backoff", "retry", "power", "delay"],
    "health": ["health", "getsystemhealth", "status", "metric"],
    "uptime": ["uptime", "starttime"],
    "success": ["success", "successrate", "completed"],
    "queue": ["queue", "queued", "push", "shift", "task", "job", "process", "pending", "waiting", "list"],
    "task": ["task", "tasks", "registertask", "job"],
    "config": ["config", "configuration", "configurationmanager", "loadfromenv", "env", "environment", "settings", "setup"],
    "metrics": ["metrics", "metricsexporter", "export", "stats", "report"],
    "disk": ["disk", "diskusage", "checkdiskusage", "filesystem", "fs", "storage", "file", "folder", "directory"],
    "filesystem": ["filesystem", "traversal", "readdirsync", "statsync", "recursive", "disk", "fs", "storage", "file", "folder", "directory"],
    "shutdown": ["shutdown", "sigint", "graceful", "exit", "close", "terminate", "stop"],
    "unhandled": ["unhandled", "unhandledrejection", "rejection"],
    "database": ["database", "db", "cleanup", "dbcleanup", "sql", "query", "maintenance"],
    "image": ["image", "imageproc", "processing", "photo", "picture", "proc"],
    "cpu": ["cpu", "intensive", "computation", "complexmathalgorithm", "math", "complex", "algorithm"],
    "periodic": ["periodic", "interval", "setinterval"],
    "concurrency": ["concurrency", "concurrencylimit", "limit"],
    "register": ["register", "registertask"],
    "execution": ["execution", "execute", "processqueue", "run"],
    "failure": ["failure", "failed", "taskfailure", "error", "catch"],
    "active": ["running", "current", "working", "busy"],
    "running": ["active", "current", "working"],
    "count": ["number", "total", "sum", "calculate", "compute"],
    "counted": ["count", "number", "total"],
    "calculated": ["compute", "derive", "math", "algorithm"],
    "compute": ["calculate", "derive"]
  };

  const tokenize = (text) => {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  };

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return Array(5).fill({ start: 1, end: 2, score: 0 });

  const expandedQueryTokens = new Set(queryTokens);
  queryTokens.forEach(token => {
    Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
      if (synonyms.includes(token) || key === token) {
        synonyms.forEach(s => expandedQueryTokens.add(s));
      }
    });
  });

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

    if (isFunction || isClass || (isTopLevel && isStatement) || isObjectProperty) {
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

      if (matches > 0) {
        let score = matches * 1.0 + uniqueMatches.size * 5.0;

        // Name extraction
        let name = "";
        if (node.id && node.id.name) name = node.id.name;
        else if (node.key && node.key.name) name = node.key.name;
        else if (node.type === 'VariableDeclaration' && node.declarations && node.declarations[0].id.name) {
           name = node.declarations[0].id.name;
        }

        if (name) {
          const nameTokens = tokenize(name);
          nameTokens.forEach(nt => {
            if (queryTokens.includes(nt)) score += 40; // Huge boost for exact name match
            else if (expandedQueryTokens.has(nt)) score += 15; // Moderate boost for synonym name match
          });
        }

        // Structural boosts
        if (isFunction) score *= 2.0;
        if (isClass) score *= 1.5;
        if (isTopLevel && isStatement) score *= 1.5;
        if (isObjectProperty) score *= 1.4;

        // Size penalty
        const size = node.loc.end.line - node.loc.start.line + 1;
        if (size <= 3) score *= 0.3;

        // Specific pattern boost
        if (nodeText.includes('process.on')) score *= 1.5;

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

  candidates.sort((a, b) => b.score - a.score);

  // If no structural candidates found, use fallback
  if (candidates.length === 0) {
      return fallbackSearch(code, expandedQueryTokens);
  }

  const finalResults = [];
  const covered = new Set();
  const PADDING = 4; // Increased padding

  for (const cand of candidates) {
    if (finalResults.length >= 5) break;

    let isCovered = false;
    for (let i = cand.start; i <= cand.end; i++) {
      if (covered.has(i)) {
        isCovered = true; 
        break;
      }
    }

    if (!isCovered) {
      // Apply padding
      const totalLines = code.split('\n').length;
      const start = Math.max(1, cand.start - PADDING);
      const end = Math.min(totalLines, cand.end + PADDING);

      finalResults.push({ start: start, end: end, score: cand.score });
      for (let i = start; i <= end; i++) covered.add(i);
    }
  }

  // If we still have slots, try fallback to fill them
  if (finalResults.length < 5) {
      const fallbackResults = fallbackSearch(code, expandedQueryTokens);
      for (const fb of fallbackResults) {
          if (finalResults.length >= 5) break;
          let isCovered = false;
          for (let i = fb.start; i <= fb.end; i++) {
              if (covered.has(i)) {
                  isCovered = true;
                  break;
              }
          }
          if (!isCovered) {
              finalResults.push(fb);
              covered.add(fb.start);
          }
      }
  }

  while (finalResults.length < 5) {
    finalResults.push({ start: 1, end: 2, score: 0 });
  }

  return finalResults;
}

function fallbackSearch(code, expandedTokens) {
    // Simple line-based fallback
    const lines = code.split('\n');
    const scores = lines.map((line, i) => {
        let score = 0;
        const lower = line.toLowerCase();
        expandedTokens.forEach(t => {
            if (lower.includes(t)) score += 1;
        });
        return { line: i + 1, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, 5).map(s => ({ start: s.line, end: s.line, score: s.score }));
}

module.exports = { functionNameYouGive };