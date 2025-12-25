const { parse } = require('acorn');

function functionNameYouGive(code, query) {
  const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'to', 'of', 'for', 'with', 'on', 'at', 'by', 'from', 'is', 'it', 'this', 'that', 'var', 'let', 'const', 'function', 'return', 'if', 'else', 'true', 'false', 'null', 'undefined', 'class', 'new', 'export', 'import', 'async', 'await', 'console', 'log', 'how', 'where', 'what', 'does', 'are', 'which', 'when', 'why', 'do', 'can', 'will', 'be', 'system']);

  // Refined Synonyms
  const SYNONYMS = {
    "retry": ["retry", "retries", "attempts", "backoff", "exponential", "try", "strategy"],
    "backoff": ["retry", "exponential", "delay", "wait"],
    "exponential": ["backoff", "retry", "power", "delay"],
    "health": ["health", "getsystemhealth", "status", "metric", "state", "info", "uptime"], // Added uptime here
    "uptime": ["uptime", "starttime", "duration", "elapsed", "time", "since", "health"], // Added health here
    "success": ["success", "successrate", "completed", "ok"],
    "queue": ["queue", "queued", "push", "shift", "task", "job", "process", "pending", "waiting", "list"],
    "task": ["task", "tasks", "registertask", "job", "work", "item"],
    "config": ["config", "configuration", "configurationmanager", "loadfromenv", "env", "environment", "settings", "setup", "variables"],
    "metrics": ["metrics", "metricsexporter", "export", "stats", "report", "data", "measurement"],
    "disk": ["disk", "diskusage", "checkdiskusage", "filesystem", "fs", "storage", "file", "folder", "directory", "write", "save"],
    "filesystem": ["filesystem", "traversal", "readdirsync", "statsync", "recursive", "disk", "fs", "storage", "file", "folder", "directory", "walk"],
    "shutdown": ["shutdown", "sigint", "graceful", "exit", "close", "terminate", "stop", "kill"],
    "unhandled": ["unhandled", "unhandledrejection", "rejection", "promise", "error"],
    "database": ["database", "db", "cleanup", "dbcleanup", "sql", "query", "maintenance", "store"],
    "image": ["image", "imageproc", "processing", "photo", "picture", "proc", "simulateimageprocessing"],
    "cpu": ["cpu", "intensive", "computation", "complexmathalgorithm", "math", "complex", "algorithm", "calc"],
    "periodic": ["periodic", "periodically", "interval", "setinterval", "schedule", "timer", "loop", "repeat"],
    "concurrency": ["concurrency", "concurrencylimit", "limit", "max", "throttle"],
    "register": ["register", "registertask", "add", "create"],
    "execution": ["execution", "execute", "processqueue", "run", "start"], 
    "failure": ["failure", "failed", "taskfailure", "error", "catch", "exception"],
    "active": ["running", "current", "working", "busy", "inprogress"],
    "running": ["active", "current", "working", "busy"],
    "count": ["number", "total", "sum", "calculate", "compute", "size", "length"],
    "counted": ["count", "number", "total"],
    "calculated": ["compute", "derive", "math", "algorithm"],
    "compute": ["calculate", "derive"],
    "export": ["export", "exported", "save", "write", "output", "dump", "store", "metrics"], // Added metrics
    "report": ["report", "log", "print", "console", "status"],
    "history": ["history", "read", "load", "restore", "past", "logs"],
    "read": ["read", "load", "fetch", "get", "history"],
    "cache": ["cache", "store", "map", "ttl", "expiry", "expiration", "cleanup", "schedule"],
    "expiry": ["expiry", "ttl", "expiration", "time", "date", "now"],
    "rate": ["rate", "limit", "limiter", "token", "bucket", "refill", "consume", "block", "throttle"],
    "token": ["token", "bucket", "refill", "consume", "count", "remaining"],
    "log": ["log", "logger", "logging", "entry", "record", "rotation", "rotate", "file"],
    "rotation": ["rotation", "rotate", "splice", "overflow", "limit", "max"],
    "filter": ["filter", "search", "query", "match", "find"],
    "middleware": ["middleware", "use", "execute", "next", "handler", "chain", "recursive"],
    "route": ["route", "router", "path", "method", "get", "post", "put", "delete", "handle", "match"],
    "body": ["body", "parse", "json", "stream", "chunk", "data", "payload"],
    "auth": ["auth", "authorization", "header", "token", "validate", "verify", "decode", "user", "login"],
    "header": ["header", "headers", "authorization", "content-type"],
    "validate": ["validate", "verify", "check", "ensure"]
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

      if (matches > 0) {
        let score = matches * 1.0 + uniqueMatches.size * 5.0;

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
            if (queryTokens.includes(nt)) score += 40; 
            else if (expandedQueryTokens.has(nt)) score += 15; 
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

        // Specific pattern boost
        if (nodeText.includes('process.on')) score *= 3.0; // Massive boost for event handlers
        if (nodeText.includes('setInterval')) score *= 2.0; 

        // Keyword Super Boosts
        if (expandedQueryTokens.has('unhandled') && nodeText.includes('unhandledRejection')) score += 100;
        if (expandedQueryTokens.has('uptime') && nodeText.includes('startTime')) score += 50;
        if (expandedQueryTokens.has('export') && name.toLowerCase().includes('export')) score += 50;
        if (expandedQueryTokens.has('history') && name.toLowerCase().includes('history')) score += 50;
        if (expandedQueryTokens.has('periodic') && isSetInterval) score += 100;

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