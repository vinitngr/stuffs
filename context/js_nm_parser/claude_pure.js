const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const natural = require("natural");

// Use natural's Porter Stemmer (proper implementation)
const PorterStemmer = natural.PorterStemmer;
const JaroWinklerDistance = natural.JaroWinklerDistance;
const TfIdf = natural.TfIdf;
const NGrams = natural.NGrams;

/**
 * KEYWORD-INDEPENDENT CODE SEARCH v5
 * Uses natural NLP package for:
 * - Porter Stemmer (proper implementation)
 * - Jaro-Winkler similarity for fuzzy matching
 * - TF-IDF for term importance
 * - N-grams for phrase matching
 */
function findTopRelevantLineRangesPure(code, query) {
  const lines = code.split("\n");
  const totalLines = lines.length;
  
  // ============== TUNABLE WEIGHTS ==============
  const WEIGHTS = {
    // BM25 parameters
    BM25_K1: 0.8,           // Term frequency saturation
    BM25_B: 0.2,            // Length normalization
    
    // Scoring weights  
    DIRECT_MATCH: 30,       // Direct query token match
    SYNONYM_MATCH: 15,      // Synonym expansion match
    PARTIAL_MATCH: 10,      // Substring match
    BIGRAM_MATCH: 50,       // Phrase match bonus
    TRIGRAM_MATCH: 70,      // 3-word phrase match
    FUZZY_MATCH: 20,        // Jaro-Winkler fuzzy match
    NAME_EXACT: 200,        // Function/class name exact match
    NAME_PARTIAL: 80,       // Function/class name partial match
    NAME_FUZZY: 60,         // Function/class name fuzzy match
    COVERAGE_MULT: 2.5,     // Coverage multiplier
    
    // Structural multipliers
    FUNCTION_MULT: 3.5,
    CLASS_MULT: 3.0,
    TOPLEVEL_MULT: 2.2,
    PROPERTY_MULT: 2.0,
    
    // Fuzzy matching threshold
    FUZZY_THRESHOLD: 0.85   // Jaro-Winkler similarity threshold
  };
  
  // Stop words - only common English words
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
  
  // UNIVERSAL programming synonyms - common across ALL codebases
  const UNIVERSAL_SYNONYMS = {
    // CRUD operations
    "create": ["create", "add", "insert", "new", "make", "generate", "build"],
    "read": ["read", "get", "fetch", "retrieve", "load", "find", "query", "select"],
    "update": ["update", "modify", "change", "edit", "set", "patch", "alter"],
    "delete": ["delete", "remove", "destroy", "clear", "erase", "drop"],
    
    // Data flow
    "send": ["send", "emit", "dispatch", "publish", "broadcast", "push", "post"],
    "receive": ["receive", "listen", "subscribe", "consume", "pull", "handle"],
    
    // Validation & checks
    "validate": ["validate", "verify", "check", "ensure", "confirm", "test"],
    "parse": ["parse", "decode", "deserialize", "extract", "interpret"],
    "format": ["format", "serialize", "encode", "stringify", "convert"],
    
    // Error handling
    "error": ["error", "err", "exception", "fault", "failure", "problem"],
    "handle": ["handle", "catch", "process", "manage", "deal"],
    "throw": ["throw", "raise", "reject", "fail"],
    "retry": ["retry", "attempt", "repeat", "again", "redo"],
    
    // Async patterns
    "async": ["async", "asynchronous", "concurrent", "parallel"],
    "wait": ["wait", "await", "delay", "sleep", "pause", "timeout"],
    "callback": ["callback", "handler", "listener", "hook"],
    "promise": ["promise", "future", "deferred", "resolve"],
    
    // Lifecycle
    "init": ["init", "initialize", "setup", "start", "begin", "boot", "launch"],
    "stop": ["stop", "shutdown", "close", "end", "terminate", "exit", "kill"],
    "reset": ["reset", "restart", "reload", "refresh", "restore"],
    
    // Storage & caching
    "save": ["save", "store", "persist", "write", "cache", "keep"],
    "load": ["load", "restore", "retrieve", "fetch", "read"],
    "cache": ["cache", "memoize", "buffer", "store"],
    "expire": ["expire", "ttl", "timeout", "invalidate", "stale"],
    
    // Collections
    "add": ["add", "push", "append", "insert", "enqueue"],
    "remove": ["remove", "pop", "shift", "dequeue", "delete"],
    "filter": ["filter", "search", "find", "query", "match", "where"],
    "sort": ["sort", "order", "rank", "arrange"],
    "map": ["map", "transform", "convert", "project"],
    
    // Counting & metrics
    "count": ["count", "total", "sum", "number", "size", "length"],
    "calculate": ["calculate", "compute", "derive", "evaluate"],
    "rate": ["rate", "ratio", "percentage", "percent", "fraction"],
    "average": ["average", "mean", "avg"],
    
    // Logging & monitoring
    "log": ["log", "print", "output", "write", "record", "trace"],
    "debug": ["debug", "trace", "inspect", "dump"],
    "monitor": ["monitor", "track", "watch", "observe"],
    
    // Auth & security
    "auth": ["auth", "authenticate", "authorization", "login", "signin", "bearer"],
    "token": ["token", "jwt", "key", "credential", "secret"],
    "permission": ["permission", "role", "access", "privilege", "grant"],
    "encrypt": ["encrypt", "hash", "cipher", "secure"],
    
    // Network & HTTP
    "request": ["request", "req", "call", "invoke", "http"],
    "response": ["response", "res", "reply", "result"],
    "route": ["route", "path", "endpoint", "url", "uri"],
    "middleware": ["middleware", "interceptor", "filter", "handler"],
    
    // Database
    "database": ["database", "db", "store", "storage", "repository"],
    "connection": ["connection", "conn", "link", "pool"],
    "transaction": ["transaction", "tx", "commit", "rollback"],
    "query": ["query", "sql", "select", "find"],
    
    // Events
    "event": ["event", "signal", "trigger", "fire"],
    "emit": ["emit", "fire", "trigger", "dispatch", "publish"],
    "listen": ["listen", "subscribe", "on", "bind", "attach"],
    
    // Config
    "config": ["config", "configuration", "settings", "options", "preferences"],
    "env": ["env", "environment", "variable", "param", "parameter"],
    
    // Files
    "file": ["file", "document", "path", "directory", "folder"],
    
    // Scheduling
    "schedule": ["schedule", "cron", "timer", "interval", "periodic"],
    "queue": ["queue", "job", "task", "worker", "background"],
    
    // Status
    "status": ["status", "state", "condition", "health"],
    "active": ["active", "running", "alive", "online", "enabled"],
    "idle": ["idle", "inactive", "stopped", "disabled", "offline"],
    
    // Limits & bounds
    "limit": ["limit", "max", "maximum", "cap", "threshold", "bound"],
    "min": ["min", "minimum", "floor", "lower"],
    
    // Cleanup
    "clean": ["clean", "cleanup", "purge", "gc", "garbage", "sweep"],
    "evict": ["evict", "expire", "remove", "prune", "trim"],
    
    // Sessions
    "session": ["session", "user", "context"],
    
    // Rotation
    "rotate": ["rotate", "roll", "cycle", "archive"]
  };
  
  // Use natural's Porter Stemmer (much better than custom)
  const stem = (word) => {
    if (word.length < 3) return word;
    return PorterStemmer.stem(word);
  };
  
  // Tokenizer with proper stemming
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
  
  // Expand tokens with universal synonyms
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
  
  // Extract bigrams using natural's NGrams
  const getBigrams = (tokens) => {
    if (tokens.length < 2) return [];
    return NGrams.bigrams(tokens).map(bg => bg.join('_'));
  };
  
  // Extract trigrams using natural's NGrams
  const getTrigrams = (tokens) => {
    if (tokens.length < 3) return [];
    return NGrams.trigrams(tokens).map(tg => tg.join('_'));
  };
  
  // Fuzzy match using Jaro-Winkler distance
  const fuzzyMatch = (word1, word2) => {
    if (word1.length < 3 || word2.length < 3) return 0;
    return JaroWinklerDistance(word1, word2);
  };
  
  const queryTokensRaw = tokenize(query, false);
  const queryTokens = tokenize(query, true);
  const queryBigrams = getBigrams(queryTokensRaw);
  const queryTrigrams = getTrigrams(queryTokensRaw);
  
  if (queryTokens.length === 0) {
    return Array(5).fill({ start: 1, end: 2, score: 0 });
  }
  
  // Expand query with universal synonyms
  const expandedQueryTokens = expandWithSynonyms(queryTokens);
  
  // ============== BM25 SETUP ==============
  // Build corpus statistics for BM25
  const allCodeTokens = tokenize(code, true);
  
  // Document frequency (how many "documents" contain each term)
  // We treat each potential AST node as a document
  const docFreq = new Map();
  const totalDocs = lines.length; // Approximate with line count
  
  // Term frequency in entire corpus
  const corpusTF = new Map();
  allCodeTokens.forEach(t => {
    corpusTF.set(t, (corpusTF.get(t) || 0) + 1);
  });
  
  // Average document length (average tokens per function/block)
  const avgDocLen = allCodeTokens.length / Math.max(1, totalDocs / 20); // Estimate ~20 lines per block
  
  // BM25 IDF calculation
  const getBM25IDF = (token) => {
    const df = corpusTF.get(token) || 0;
    const N = totalDocs;
    // BM25 IDF formula: log((N - df + 0.5) / (df + 0.5) + 1)
    return Math.log((N - df + 0.5) / (df + 0.5) + 1);
  };
  
  // BM25 score for a term in a document
  const getBM25Score = (termFreq, docLen, idf) => {
    const k1 = WEIGHTS.BM25_K1;
    const b = WEIGHTS.BM25_B;
    // BM25 formula: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen))
    const numerator = termFreq * (k1 + 1);
    const denominator = termFreq + k1 * (1 - b + b * docLen / avgDocLen);
    return idf * (numerator / denominator);
  };
  
  const queryTokenSet = new Set(queryTokens);
  const queryTokenSetRaw = new Set(queryTokensRaw);
  
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript", "decorators-legacy", "classProperties", "dynamicImport", "optionalChaining", "nullishCoalescingOperator"],
      errorRecovery: true
    });
  } catch (e) {
    return fallbackSearch(lines, queryTokenSet, totalLines, queryTokens, stem);
  }
  
  const candidates = [];
  
  const getText = (startLine, endLine) => {
    return lines.slice(startLine - 1, endLine).join(" ");
  };
  
  // Get comments near a line range
  const getComments = (startLine, endLine) => {
    const commentLines = [];
    // Check 3 lines before for comments
    for (let i = Math.max(0, startLine - 4); i < startLine - 1; i++) {
      const line = lines[i];
      if (line && (line.includes('//') || line.includes('/*') || line.includes('*'))) {
        commentLines.push(line);
      }
    }
    return commentLines.join(' ');
  };
  
  // Walk AST
  traverse(ast, {
    enter(path) {
      const node = path.node;
      if (!node.loc) return;
      
      const startLine = node.loc.start.line;
      const endLine = node.loc.end.line;
      
      // Structural blocks
      const isFunction = path.isFunction() || path.isClassMethod() || path.isObjectMethod();
      const isClass = path.isClassDeclaration();
      const isTopLevel = path.parentPath && path.parentPath.isProgram();
      const isStatement = path.isExpressionStatement() || path.isVariableDeclaration();
      const isObjectProperty = path.isObjectProperty() && (endLine - startLine > 2);
      
      if (isFunction || isClass || (isTopLevel && isStatement) || isObjectProperty) {
        const nodeText = getText(startLine, endLine);
        const commentText = getComments(startLine, endLine);
        const fullText = nodeText + ' ' + commentText;
        
        const nodeTokensRaw = tokenize(fullText, false);
        const nodeTokens = tokenize(fullText, true);
        const nodeBigrams = getBigrams(nodeTokensRaw);
        const nodeTrigrams = getTrigrams(nodeTokensRaw);
        const docLen = nodeTokens.length;
        
        // ============== BM25 SCORING ==============
        let score = 0;
        const matchedTokens = new Set();
        
        // Build term frequency map for this document
        const docTF = new Map();
        nodeTokens.forEach(t => {
          docTF.set(t, (docTF.get(t) || 0) + 1);
        });
        
        // 1. BM25 scoring for direct query matches
        queryTokens.forEach(qt => {
          const tf = docTF.get(qt) || 0;
          if (tf > 0) {
            const idf = getBM25IDF(qt);
            const bm25Score = getBM25Score(tf, docLen, idf);
            score += bm25Score * WEIGHTS.DIRECT_MATCH;
            matchedTokens.add(qt);
          }
        });
        
        // 2. BM25 scoring for synonym matches (lower weight)
        expandedQueryTokens.forEach(et => {
          if (!queryTokenSet.has(et)) {  // Skip direct matches already counted
            const tf = docTF.get(et) || 0;
            if (tf > 0) {
              const idf = getBM25IDF(et);
              const bm25Score = getBM25Score(tf, docLen, idf);
              score += bm25Score * WEIGHTS.SYNONYM_MATCH;
              matchedTokens.add(et);
            }
          }
        });
        
        // 3. Substring/partial matching (for compound words)
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
        
        // 3.5 NEW: Fuzzy matching using Jaro-Winkler for unmatched tokens
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
        
        // 4. Bigram matching (phrase matching) - high value
        queryBigrams.forEach(qb => {
          if (nodeBigrams.includes(qb)) {
            score += WEIGHTS.BIGRAM_MATCH;
          }
        });
        
        // 4.5 NEW: Trigram matching (3-word phrases) - even higher value
        queryTrigrams.forEach(qt => {
          if (nodeTrigrams.includes(qt)) {
            score += WEIGHTS.TRIGRAM_MATCH;
          }
        });
        
        // 5. Coverage bonus - reward matching more unique query terms
        const coverage = matchedTokens.size / Math.max(1, queryTokens.length);
        score *= (1 + coverage * WEIGHTS.COVERAGE_MULT);
        
        if (score > 0) {
          // Extract name from AST node
          let name = "";
          if (node.id && node.id.name) {
            name = node.id.name.toLowerCase();
          } else if (node.key && node.key.name) {
            name = node.key.name.toLowerCase();
          }
          
          // 6. Name matching bonus - critical for finding right functions
          if (name) {
            const nameTokens = tokenize(name, true);
            const nameTokensRaw = tokenize(name, false);
            
            nameTokens.forEach((nt, idx) => {
              // Exact stemmed match in function/class name
              if (queryTokenSet.has(nt)) {
                score += WEIGHTS.NAME_EXACT;
              }
              // Raw match (unstemmed)
              if (queryTokenSetRaw.has(nameTokensRaw[idx])) {
                score += WEIGHTS.NAME_EXACT * 0.5;
              }
              // Synonym match in name
              if (expandedQueryTokens.has(nt) && !queryTokenSet.has(nt)) {
                score += WEIGHTS.NAME_PARTIAL;
              }
              // Substring match in name
              queryTokens.forEach(qt => {
                if (qt.length >= 4 && nt.length >= 4 && (nt.includes(qt) || qt.includes(nt))) {
                  score += WEIGHTS.NAME_PARTIAL;
                }
              });
              // NEW: Fuzzy match in name using Jaro-Winkler
              queryTokens.forEach(qt => {
                if (qt.length >= 4 && nt.length >= 4) {
                  const similarity = fuzzyMatch(qt, nt);
                  if (similarity >= WEIGHTS.FUZZY_THRESHOLD && !queryTokenSet.has(nt)) {
                    score += WEIGHTS.NAME_FUZZY * similarity;
                  }
                }
              });
            });
          }
          
          // 7. Structural multipliers
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
  
  // Select with overlap handling - strict no overlap
  const finalResults = [];
  const covered = new Set();
  
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
      finalResults.push({ start: cand.start, end: cand.end, score: cand.score });
      for (let i = cand.start; i <= cand.end; i++) {
        covered.add(i);
      }
    }
  }
  
  // Fallback fillers
  while (finalResults.length < 5) {
    finalResults.push({ start: 1, end: 2, score: 0 });
  }
  
  return finalResults;
}

function fallbackSearch(lines, queryTokenSet, totalLines, queryTokens, stem) {
  const lineScores = [];
  const queryTokensArr = Array.from(queryTokenSet);
  
  lines.forEach((line, idx) => {
    let score = 0;
    const lineLower = line.toLowerCase();
    const lineTokens = lineLower.split(/\W+/).filter(t => t.length > 2).map(stem);
    
    queryTokensArr.forEach(qt => {
      // Exact token match
      if (lineTokens.includes(qt)) score += 10;
      // Substring match
      else if (lineLower.includes(qt)) score += 3;
    });
    
    if (score > 0) {
      lineScores.push({ line: idx + 1, score });
    }
  });
  
  lineScores.sort((a, b) => b.score - a.score);
  
  const results = [];
  const usedLines = new Set();
  
  lineScores.slice(0, 15).forEach(({ line, score }) => {
    if (results.length >= 5) return;
    
    const start = Math.max(1, line - 7);
    const end = Math.min(totalLines, line + 7);
    
    let hasOverlap = false;
    for (let l = start; l <= end; l++) {
      if (usedLines.has(l)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (!hasOverlap) {
      results.push({ start, end, score: score * 10 });
      for (let l = start; l <= end; l++) {
        usedLines.add(l);
      }
    }
  });
  
  while (results.length < 5) {
    results.push({ start: 1, end: 2, score: 0 });
  }
  
  return results;
}

module.exports = { findTopRelevantLineRangesPure };
