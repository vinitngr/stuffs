const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const natural = require("natural");
const fs = require("fs");
const path = require("path");
const PorterStemmer = natural.PorterStemmer;
const JaroWinklerDistance = natural.JaroWinklerDistance;
const NGrams = natural.NGrams;

const DEFAULT_CONFIG = {
  minLines: 10,
  maxLines: 100,
  topK: 5,
  smartExpand: false,
  outputFile: 'pickedup.json'
};

const WEIGHTS = {
  BM25_K1: 1.2,
  BM25_B: 0.3,
  DIRECT_MATCH: 35,
  SYNONYM_MATCH: 18,
  PARTIAL_MATCH: 12,
  BIGRAM_MATCH: 60,
  TRIGRAM_MATCH: 80,
  FUZZY_MATCH: 25,
  NAME_EXACT: 250,
  NAME_PARTIAL: 100,
  NAME_FUZZY: 70,
  COVERAGE_MULT: 3.0,
  FUNCTION_MULT: 4.0,
  CLASS_MULT: 3.5,
  TOPLEVEL_MULT: 2.5,
  PROPERTY_MULT: 2.2,
  FUZZY_THRESHOLD: 0.80
};

const STOP_WORDS = new Set([
  "and", "or", "the", "a", "an", "in", "to", "of", "for", "with", "on", "at", 
  "by", "from", "is", "it", "this", "that", "how", "where", "what", "does", 
  "are", "which", "when", "why", "do", "can", "will", "be", "has", "have",
  "been", "being", "was", "were", "would", "could", "should", "may", "might",
  "must", "shall", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "over", "out", "off", "down", "up", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "only", "own", "same", "than", "too", "very", "just", "also", "any"
]);

const UNIVERSAL_SYNONYMS = {
  "create": ["create", "add", "insert", "new", "make", "generate", "build"],
  "read": ["read", "get", "fetch", "retrieve", "load", "find", "query", "select"],
  "update": ["update", "modify", "change", "edit", "set", "patch", "alter"],
  "delete": ["delete", "remove", "destroy", "clear", "erase", "drop"],
  "send": ["send", "emit", "dispatch", "publish", "broadcast", "push", "post"],
  "receive": ["receive", "listen", "subscribe", "consume", "pull", "handle"],
  "validate": ["validate", "verify", "check", "ensure", "confirm", "test"],
  "parse": ["parse", "decode", "deserialize", "extract", "interpret"],
  "format": ["format", "serialize", "encode", "stringify", "convert"],
  "error": ["error", "err", "exception", "fault", "failure", "problem"],
  "handle": ["handle", "catch", "process", "manage", "deal"],
  "throw": ["throw", "raise", "reject", "fail"],
  "retry": ["retry", "attempt", "repeat", "again", "redo"],
  "async": ["async", "asynchronous", "concurrent", "parallel"],
  "wait": ["wait", "await", "delay", "sleep", "pause", "timeout"],
  "callback": ["callback", "handler", "listener", "hook"],
  "promise": ["promise", "future", "deferred", "resolve"],
  "init": ["init", "initialize", "setup", "start", "begin", "boot", "launch"],
  "stop": ["stop", "shutdown", "close", "end", "terminate", "exit", "kill"],
  "reset": ["reset", "restart", "reload", "refresh", "restore"],
  "save": ["save", "store", "persist", "write", "cache", "keep"],
  "load": ["load", "restore", "retrieve", "fetch", "read"],
  "cache": ["cache", "memoize", "buffer", "store"],
  "expire": ["expire", "ttl", "timeout", "invalidate", "stale"],
  "add": ["add", "push", "append", "insert", "enqueue"],
  "remove": ["remove", "pop", "shift", "dequeue", "delete"],
  "filter": ["filter", "search", "find", "query", "match", "where"],
  "sort": ["sort", "order", "rank", "arrange"],
  "map": ["map", "transform", "convert", "project"],
  "count": ["count", "total", "sum", "number", "size", "length"],
  "calculate": ["calculate", "compute", "derive", "evaluate"],
  "rate": ["rate", "ratio", "percentage", "percent", "fraction"],
  "log": ["log", "print", "output", "write", "record", "trace"],
  "debug": ["debug", "trace", "inspect", "dump"],
  "monitor": ["monitor", "track", "watch", "observe"],
  "auth": ["auth", "authenticate", "authorization", "login", "signin", "bearer"],
  "token": ["token", "jwt", "key", "credential", "secret"],
  "permission": ["permission", "role", "access", "privilege", "grant"],
  "request": ["request", "req", "call", "invoke", "http"],
  "response": ["response", "res", "reply", "result"],
  "route": ["route", "path", "endpoint", "url", "uri"],
  "middleware": ["middleware", "interceptor", "filter", "handler"],
  "database": ["database", "db", "store", "storage", "repository"],
  "connection": ["connection", "conn", "link", "pool"],
  "event": ["event", "signal", "trigger", "fire"],
  "emit": ["emit", "fire", "trigger", "dispatch", "publish"],
  "listen": ["listen", "subscribe", "on", "bind", "attach"],
  "config": ["config", "configuration", "settings", "options", "preferences"],
  "file": ["file", "document", "path", "directory", "folder"],
  "schedule": ["schedule", "cron", "timer", "interval", "periodic"],
  "queue": ["queue", "job", "task", "worker", "background"],
  "status": ["status", "state", "condition", "health"],
  "limit": ["limit", "max", "maximum", "cap", "threshold", "bound"],
  "clean": ["clean", "cleanup", "purge", "gc", "garbage", "sweep"],
  "session": ["session", "user", "context"],
  "rotate": ["rotate", "roll", "cycle", "archive"],
  
  "register": ["register", "signup", "enroll", "add", "create", "insert"],
  "execute": ["execute", "run", "invoke", "call", "perform", "do"],
  "select": ["select", "choose", "pick", "get", "find"],
  "acquire": ["acquire", "obtain", "get", "lock", "take"],
  "release": ["release", "free", "unlock", "drop", "let"],
  "health": ["health", "status", "alive", "ping", "heartbeat", "check"],
  "metrics": ["metrics", "stats", "statistics", "measure", "telemetry"],
  "success": ["success", "ok", "pass", "complete", "done", "finish"],
  "fail": ["fail", "error", "failure", "crash", "abort"],
  "refill": ["refill", "replenish", "restore", "reset", "reload"],
  "balance": ["balance", "distribute", "spread", "allocate", "share"],
  "round": ["round", "cycle", "rotate", "circular", "robin"],
  "lock": ["lock", "mutex", "semaphore", "synchronize", "block"],
  "priority": ["priority", "weight", "importance", "rank", "order"],
  "disk": ["disk", "storage", "filesystem", "drive", "volume"],
  "usage": ["usage", "utilization", "consumption", "use"],
  "email": ["email", "mail", "address", "contact"],
  "regex": ["regex", "regexp", "pattern", "match", "expression"],
  "sequence": ["sequence", "order", "chain", "pipeline", "flow"],
  "endpoint": ["endpoint", "url", "uri", "path", "route", "address"],
  
  "login": ["login", "signin", "authenticate", "auth", "session"],
  "logout": ["logout", "signout", "unauthenticate", "session"],
  "register": ["register", "signup", "enroll", "add", "create", "user"],
  "cart": ["cart", "basket", "bag", "shopping", "item"],
  "order": ["order", "purchase", "checkout", "buy", "transaction"],
  "product": ["product", "item", "goods", "merchandise", "inventory"],
  "user": ["user", "account", "profile", "member", "customer"],
  "admin": ["admin", "administrator", "superuser", "root", "management"],
  "upload": ["upload", "file", "image", "attachment", "media"],
  "password": ["password", "passwd", "pwd", "credential", "secret", "hash"],
  "stock": ["stock", "inventory", "quantity", "available", "supply"],
  "price": ["price", "cost", "amount", "total", "value"],
  "shipping": ["shipping", "delivery", "ship", "address", "location"],
  "payment": ["payment", "pay", "charge", "billing", "transaction"],
  "search": ["search", "find", "query", "lookup", "filter", "q"],
  "list": ["list", "all", "index", "collection", "array", "get"],
  "get": ["get", "fetch", "retrieve", "read", "find", "show"],
  "post": ["post", "create", "add", "insert", "new", "submit"],
  "put": ["put", "update", "modify", "change", "edit", "replace"],
  "patch": ["patch", "update", "modify", "partial"],
  "remove": ["remove", "delete", "destroy", "clear", "erase"],
  "crud": ["crud", "create", "read", "update", "delete", "operation"],
  "precision": ["precision", "float", "decimal", "round", "accurate"],
  "sensitive": ["sensitive", "case", "match", "exact", "strict"],
  "access": ["access", "view", "see", "read", "authorization", "permission"],
  "single": ["single", "one", "specific", "individual", "id", "detail"],
  "calculation": ["calculation", "compute", "calculate", "sum", "total", "reduce"]
};

const stem = (word) => {
  if (word.length < 3) return word;
  return PorterStemmer.stem(word);
};

const tokenize = (text, applyStem = true) => {
  const tokens = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  
  return applyStem ? tokens.map(stem) : tokens;
};

const expandWithSynonyms = (tokens) => {
  const expanded = new Set(tokens);
  tokens.forEach(token => {
    Object.entries(UNIVERSAL_SYNONYMS).forEach(([key, synonyms]) => {
      if (key === token || synonyms.some(s => s === token || stem(s) === token)) {
        expanded.add(key);
        synonyms.forEach(s => {
          expanded.add(s);
          expanded.add(stem(s));
        });
      }
    });
  });
  return expanded;
};

const getBigrams = (tokens) => {
  if (tokens.length < 2) return [];
  return NGrams.bigrams(tokens).map(bg => bg.join('_'));
};

const getTrigrams = (tokens) => {
  if (tokens.length < 3) return [];
  return NGrams.trigrams(tokens).map(tg => tg.join('_'));
};

const fuzzyMatch = (word1, word2) => {
  if (word1.length < 3 || word2.length < 3) return 0;
  return JaroWinklerDistance(word1, word2);
};

function search(codeOrFilePath, query, config = {}) {
  console.time('Search Time');
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  let code;
  if (codeOrFilePath.includes('\n') || codeOrFilePath.length > 500) {
    code = codeOrFilePath;
  } else if (fs.existsSync(codeOrFilePath)) {
    code = fs.readFileSync(codeOrFilePath, 'utf-8');
  } else {
    code = codeOrFilePath;
  }
  
  const lines = code.split("\n");
  const totalLines = lines.length;
  
  const queryTokensRaw = tokenize(query, false);
  const queryTokens = tokenize(query, true);
  const queryBigrams = getBigrams(queryTokensRaw);
  const queryTrigrams = getTrigrams(queryTokensRaw);
  
  if (queryTokens.length === 0) {
    return [];
  }
  
  const expandedQueryTokens = expandWithSynonyms(queryTokens);
  
  const allCodeTokens = tokenize(code, true);
  const corpusTF = new Map();
  allCodeTokens.forEach(t => {
    corpusTF.set(t, (corpusTF.get(t) || 0) + 1);
  });
  const avgDocLen = allCodeTokens.length / Math.max(1, totalLines / 20);
  
  const getBM25IDF = (token) => {
    const df = corpusTF.get(token) || 0;
    return Math.log((totalLines - df + 0.5) / (df + 0.5) + 1);
  };
  
  const getBM25Score = (termFreq, docLen, idf) => {
    const numerator = termFreq * (WEIGHTS.BM25_K1 + 1);
    const denominator = termFreq + WEIGHTS.BM25_K1 * (1 - WEIGHTS.BM25_B + WEIGHTS.BM25_B * docLen / avgDocLen);
    return idf * (numerator / denominator);
  };
  
  const queryTokenSet = new Set(queryTokens);
  const queryTokenSetRaw = new Set(queryTokensRaw);
  
  let ast;
  let functionBoundaries = [];
  
  try {
    ast = parser.parse(code, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript", "decorators-legacy", "classProperties", "dynamicImport", "optionalChaining", "nullishCoalescingOperator"],
      errorRecovery: true
    });
  } catch (e) {
    return fallbackSearch(lines, queryTokenSet, totalLines, queryTokens, cfg);
  }
  
  const candidates = [];
  
  const getText = (startLine, endLine) => {
    return lines.slice(startLine - 1, endLine).join(" ");
  };
  
  const getComments = (startLine, endLine) => {
    const commentLines = [];
    for (let i = Math.max(0, startLine - 4); i < startLine - 1; i++) {
      const line = lines[i];
      if (line && (line.includes('//') || line.includes('/*') || line.includes('*'))) {
        commentLines.push(line);
      }
    }
    return commentLines.join(' ');
  };
  
  traverse(ast, {
    enter(path) {
      const node = path.node;
      if (!node.loc) return;
      
      const startLine = node.loc.start.line;
      const endLine = node.loc.end.line;
      const size = endLine - startLine + 1;
      
      const isFunction = path.isFunction() || path.isClassMethod() || path.isObjectMethod();
      const isClass = path.isClassDeclaration();
      
      if (isFunction || isClass) {
        let name = "";
        if (node.id && node.id.name) name = node.id.name;
        else if (node.key && node.key.name) name = node.key.name;
        
        functionBoundaries.push({
          start: startLine,
          end: endLine,
          size: size,
          name: name,
          type: isClass ? 'class' : 'function'
        });
      }
    }
  });
  
  // Sort by start line for efficient lookup
  functionBoundaries.sort((a, b) => a.start - b.start);
  
  const extractExpressRouteName = (node) => {
    if (node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression') {
      const obj = node.callee.object;
      const prop = node.callee.property;
      const objName = obj.name || (obj.callee && obj.callee.property && obj.callee.property.name);
      const methodName = prop.name;
      
      if (['get', 'post', 'put', 'patch', 'delete', 'use', 'all'].includes(methodName)) {
        if (node.arguments && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === 'StringLiteral' || firstArg.type === 'Literal') {
            const route = firstArg.value || firstArg.raw;
            const callerName = obj.name || 'app';
            return `${callerName}.${methodName}('${route}')`;
          }
          if (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression') {
            const params = firstArg.params.map(p => p.name).join(', ');
            return `${obj.name || 'app'}.${methodName}((${params}))`;
          }
        }
        return `${obj.name || 'app'}.${methodName}`;
      }
    }
    return null;
  };
  
  traverse(ast, {
    enter(path) {
      const node = path.node;
      if (!node.loc) return;
      
      const startLine = node.loc.start.line;
      const endLine = node.loc.end.line;
      
      let expressRouteName = null;
      if (path.isExpressionStatement() && node.expression && node.expression.type === 'CallExpression') {
        expressRouteName = extractExpressRouteName(node.expression);
      }
      
      if (path.isFunction()) {
        const parent = path.parentPath;
        if (parent && parent.isCallExpression()) {
          const grandParent = parent.parentPath;
          if (grandParent && grandParent.isExpressionStatement()) {
            const possibleRoute = extractExpressRouteName(grandParent.node.expression);
            if (possibleRoute) {
              return;
            }
          }
        }
      }
      
      const isFunction = path.isFunction() || path.isClassMethod() || path.isObjectMethod();
      const isClass = path.isClassDeclaration();
      const isTopLevel = path.parentPath && path.parentPath.isProgram();
      const isStatement = path.isExpressionStatement() || path.isVariableDeclaration();
      const isObjectProperty = path.isObjectProperty() && (endLine - startLine > 2);
      
      if (isFunction || isClass || (isTopLevel && isStatement) || isObjectProperty || expressRouteName) {
        const nodeText = getText(startLine, endLine);
        const commentText = getComments(startLine, endLine);
        const fullText = nodeText + ' ' + commentText;
        
        const nodeTokensRaw = tokenize(fullText, false);
        const nodeTokens = tokenize(fullText, true);
        const nodeBigrams = getBigrams(nodeTokensRaw);
        const nodeTrigrams = getTrigrams(nodeTokensRaw);
        const docLen = nodeTokens.length;
        
        let score = 0;
        const matchedTokens = new Set();
        
        const docTF = new Map();
        nodeTokens.forEach(t => {
          docTF.set(t, (docTF.get(t) || 0) + 1);
        });
        
        // BM25 scoring
        queryTokens.forEach(qt => {
          const tf = docTF.get(qt) || 0;
          if (tf > 0) {
            const idf = getBM25IDF(qt);
            score += getBM25Score(tf, docLen, idf) * WEIGHTS.DIRECT_MATCH;
            matchedTokens.add(qt);
          }
        });
        
        expandedQueryTokens.forEach(et => {
          if (!queryTokenSet.has(et)) {
            const tf = docTF.get(et) || 0;
            if (tf > 0) {
              const idf = getBM25IDF(et);
              score += getBM25Score(tf, docLen, idf) * WEIGHTS.SYNONYM_MATCH;
              matchedTokens.add(et);
            }
          }
        });
        
        queryTokens.forEach(qt => {
          if (!matchedTokens.has(qt) && qt.length >= 4) {
            nodeTokens.forEach(nt => {
              if (nt.length >= 4 && (nt.includes(qt) || qt.includes(nt))) {
                score += WEIGHTS.PARTIAL_MATCH;
                matchedTokens.add(qt);
              }
            });
          }
        });
        
        queryTokens.forEach(qt => {
          if (!matchedTokens.has(qt) && qt.length >= 4) {
            for (const nt of nodeTokens) {
              if (nt.length >= 4) {
                const similarity = fuzzyMatch(qt, nt);
                if (similarity >= WEIGHTS.FUZZY_THRESHOLD) {
                  score += WEIGHTS.FUZZY_MATCH * similarity;
                  matchedTokens.add(qt);
                  break;
                }
              }
            }
          }
        });
        
        queryBigrams.forEach(qb => {
          if (nodeBigrams.includes(qb)) score += WEIGHTS.BIGRAM_MATCH;
        });
        queryTrigrams.forEach(qt => {
          if (nodeTrigrams.includes(qt)) score += WEIGHTS.TRIGRAM_MATCH;
        });
        
        const coverage = matchedTokens.size / Math.max(1, queryTokens.length);
        score *= (1 + coverage * WEIGHTS.COVERAGE_MULT);
        
        if (score > 0) {
          let name = "";
          
          if (expressRouteName) {
            name = expressRouteName;
          }
          else if (node.id && node.id.name) name = node.id.name.toLowerCase();
          else if (node.key && node.key.name) name = node.key.name.toLowerCase();
          else if (node.declarations && node.declarations[0] && node.declarations[0].id) {
            name = node.declarations[0].id.name || '';
          }
          
          if (name) {
            const nameTokens = tokenize(name, true);
            const nameTokensRaw = tokenize(name, false);
            
            nameTokens.forEach((nt, idx) => {
              if (queryTokenSet.has(nt)) score += WEIGHTS.NAME_EXACT;
              if (queryTokenSetRaw.has(nameTokensRaw[idx])) score += WEIGHTS.NAME_EXACT * 0.5;
              if (expandedQueryTokens.has(nt) && !queryTokenSet.has(nt)) score += WEIGHTS.NAME_PARTIAL;
              queryTokens.forEach(qt => {
                if (qt.length >= 4 && nt.length >= 4 && (nt.includes(qt) || qt.includes(nt))) {
                  score += WEIGHTS.NAME_PARTIAL;
                }
                if (qt.length >= 4 && nt.length >= 4) {
                  const similarity = fuzzyMatch(qt, nt);
                  if (similarity >= WEIGHTS.FUZZY_THRESHOLD && !queryTokenSet.has(nt)) {
                    score += WEIGHTS.NAME_FUZZY * similarity;
                  }
                }
              });
            });
          }
          
          // Structural multipliers
          if (isFunction) score *= WEIGHTS.FUNCTION_MULT;
          else if (isClass) score *= WEIGHTS.CLASS_MULT;
          else if (isTopLevel && isStatement) score *= WEIGHTS.TOPLEVEL_MULT;
          else if (isObjectProperty) score *= WEIGHTS.PROPERTY_MULT;
          
          candidates.push({
            start: startLine,
            end: endLine,
            score: score,
            type: node.type,
            name: name,
            size: endLine - startLine + 1
          });
        }
      }
    }
  });
  
  // Sort by score
  candidates.sort((a, b) => b.score - a.score);
  
  const smartExpandRange = (start, end, originalSize) => {
    let newStart = start;
    let newEnd = end;
    const currentSize = end - start + 1;
    
    if (!cfg.smartExpand) {
      // Just apply min/max without smart expansion
      if (currentSize < cfg.minLines) {
        const expand = Math.ceil((cfg.minLines - currentSize) / 2);
        newStart = Math.max(1, start - expand);
        newEnd = Math.min(totalLines, end + expand);
      }
      if (newEnd - newStart + 1 > cfg.maxLines) {
        newEnd = newStart + cfg.maxLines - 1;
      }
      return { start: newStart, end: newEnd };
    }
    
    // Find the containing function/class
    let containingBlock = null;
    for (const block of functionBoundaries) {
      if (block.start <= start && block.end >= end) {
        // Found a containing block
        if (!containingBlock || block.size < containingBlock.size) {
          containingBlock = block; // Prefer smaller (more specific) container
        }
      }
    }
    
    if (containingBlock) {
      if (containingBlock.size <= cfg.maxLines) {
        // Small function - expand to full function boundaries
        newStart = containingBlock.start;
        newEnd = containingBlock.end;
      } else {
        // Big function - take chunk around the match, but try to get meaningful boundaries
        const midPoint = Math.floor((start + end) / 2);
        const halfMax = Math.floor(cfg.maxLines / 2);
        
        newStart = Math.max(containingBlock.start, midPoint - halfMax);
        newEnd = Math.min(containingBlock.end, midPoint + halfMax);
        
        for (let i = newStart; i > Math.max(1, newStart - 10); i--) {
          const line = lines[i - 1].trim();
          if (line === '' || line === '{' || line.endsWith('{')) {
            newStart = i;
            break;
          }
        }
      }
    }
    
    // Ensure minimum lines
    const finalSize = newEnd - newStart + 1;
    if (finalSize < cfg.minLines) {
      const needed = cfg.minLines - finalSize;
      const expandBefore = Math.ceil(needed / 2);
      const expandAfter = Math.floor(needed / 2);
      newStart = Math.max(1, newStart - expandBefore);
      newEnd = Math.min(totalLines, newEnd + expandAfter);
    }
    
    // Enforce maximum
    if (newEnd - newStart + 1 > cfg.maxLines) {
      newEnd = newStart + cfg.maxLines - 1;
    }
    
    return { start: newStart, end: Math.min(newEnd, totalLines) };
  };
  
  // Select top K with overlap handling and smart expansion
  const finalResults = [];
  const covered = new Set();
  
  for (const cand of candidates) {
    if (finalResults.length >= cfg.topK) break;
    
    // Check for overlap with already selected results
    let isCovered = false;
    for (let i = cand.start; i <= cand.end; i++) {
      if (covered.has(i)) {
        isCovered = true;
        break;
      }
    }
    
    if (!isCovered) {
      // Apply smart expansion
      const expanded = smartExpandRange(cand.start, cand.end, cand.size);
      
      // Get the code snippet
      const codeSnippet = lines.slice(expanded.start - 1, expanded.end).join('\n');
      
      finalResults.push({
        rank: finalResults.length + 1,
        start: expanded.start,
        end: expanded.end,
        originalStart: cand.start,
        originalEnd: cand.end,
        lines: expanded.end - expanded.start + 1,
        score: Math.round(cand.score * 100) / 100,
        name: cand.name || null,
        type: cand.type,
        code: codeSnippet
      });
      
      // Mark as covered
      for (let i = expanded.start; i <= expanded.end; i++) {
        covered.add(i);
      }
    }
  }

  return finalResults;
}

function fallbackSearch(lines, queryTokenSet, totalLines, queryTokens, cfg) {
  const lineScores = [];
  const queryTokensArr = Array.from(queryTokenSet);
  
  lines.forEach((line, idx) => {
    let score = 0;
    const lineLower = line.toLowerCase();
    const lineTokens = lineLower.split(/\W+/).filter(t => t.length > 2).map(stem);
    
    queryTokensArr.forEach(qt => {
      if (lineTokens.includes(qt)) score += 10;
      else if (lineLower.includes(qt)) score += 3;
    });
    
    if (score > 0) lineScores.push({ line: idx + 1, score });
  });
  
  lineScores.sort((a, b) => b.score - a.score);
  
  const results = [];
  const usedLines = new Set();
  
  lineScores.slice(0, cfg.topK * 3).forEach(({ line, score }) => {
    if (results.length >= cfg.topK) return;
    
    const halfRange = Math.floor(cfg.minLines / 2);
    const start = Math.max(1, line - halfRange);
    const end = Math.min(totalLines, line + halfRange);
    
    let hasOverlap = false;
    for (let l = start; l <= end; l++) {
      if (usedLines.has(l)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (!hasOverlap) {
      const codeSnippet = lines.slice(start - 1, end).join('\n');
      results.push({
        rank: results.length + 1,
        start,
        end,
        lines: end - start + 1,
        score: score * 10,
        code: codeSnippet
      });
      for (let l = start; l <= end; l++) usedLines.add(l);
    }
  });
  
  return results;
}

function searchAndSave(codeOrFilePath, query, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  console.time("Total Search Time");
  // Determine if input is file path or code
  let code;
  let sourcePath = null;
  
  if (codeOrFilePath.includes('\n') || codeOrFilePath.length > 500) {
    // Likely code string
    code = codeOrFilePath;
  } else if (fs.existsSync(codeOrFilePath)) {
    // File path
    code = fs.readFileSync(codeOrFilePath, 'utf-8');
    sourcePath = codeOrFilePath;
  } else {
    // Assume it's code
    code = codeOrFilePath;
  }
  
  // Run search
  const results = search(code, query, cfg);
  
  // Prepare output
  const output = {
    query: query,
    timestamp: new Date().toISOString(),
    config: {
      minLines: cfg.minLines,
      maxLines: cfg.maxLines,
      topK: cfg.topK,
      smartExpand: cfg.smartExpand
    },
    source: sourcePath || '(inline code)',
    totalResults: results.length,
    results: results
  };
  
  // Save to JSON
  const outputPath = path.join(__dirname, cfg.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n🎯 THE CHOSEN ONE - Search Results`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Query: "${query}"`);
  console.log(`Config: min=${cfg.minLines}, max=${cfg.maxLines}, topK=${cfg.topK}`);
  console.log(`${'─'.repeat(50)}`);
  
  results.forEach((r, idx) => {
    console.log(`\n#${r.rank} | Lines ${r.start}-${r.end} (${r.lines} lines) | Score: ${r.score}`);
    if (r.name) console.log(`   Name: ${r.name}`);
    console.log(`   Preview: ${r.code.split('\n')[0].substring(0, 60)}...`);
  });
  
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.timeEnd("Total Search Time");
  
  return output;
}

module.exports = { 
  search,
  searchAndSave,
  DEFAULT_CONFIG,
  WEIGHTS
};

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
  
  searchAndSave(filePath, query, config);
}
