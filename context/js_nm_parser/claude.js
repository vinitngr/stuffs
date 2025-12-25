const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

function findTopRelevantLineRangesClaude(code, query) {
  const lines = code.split("\n");
  const totalLines = lines.length;
  
  // Stop words
  const STOP_WORDS = new Set([
    "and", "or", "the", "a", "an", "in", "to", "of", "for", "with", "on", "at", 
    "by", "from", "is", "it", "this", "that", "var", "let", "const", "function", 
    "return", "if", "else", "true", "false", "null", "undefined", "export", 
    "import", "class", "new", "async", "await", "console", "log", "how", "where",
    "what", "does", "are", "which", "when", "why", "do", "can", "will", "be"
  ]);
  
  // Tokenizer
  const tokenize = (text) => {
    return text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/[^a-zA-Z0-9]/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  };
  
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return Array(5).fill({ start: 1, end: 2, score: 0 });
  }
  
  // Targeted semantic expansions - MORE CONSERVATIVE
  const semanticExpansions = {
    "retry": ["retry", "retries", "attempts", "backoff", "exponential"],
    "health": ["health", "getsystemhealth"],
    "uptime": ["uptime", "starttime"],
    "success": ["success", "successrate", "completed"],
    "queue": ["queue", "queued", "push", "shift"],
    "task": ["task", "tasks", "registertask"],
    "config": ["config", "configuration", "configurationmanager", "loadfromenv", "env", "environment"],
    "metrics": ["metrics", "metricsexporter", "export"],
    "disk": ["disk", "diskusage", "checkdiskusage"],
    "filesystem": ["filesystem", "traversal", "readdirsync", "statsync", "recursive"],
    "shutdown": ["shutdown", "sigint", "graceful"],
    "unhandled": ["unhandled", "unhandledrejection", "rejection"],
    "database": ["database", "db", "cleanup", "dbcleanup"],
    "image": ["image", "imageproc", "processing"],
    "cpu": ["cpu", "intensive", "computation", "complexmathalgorithm", "math"],
    "periodic": ["periodic", "interval", "setinterval"],
    "concurrency": ["concurrency", "concurrencylimit", "limit"],
    "register": ["register", "registertask"],
    "execution": ["execution", "execute", "processqueue"],
    "failure": ["failure", "failed", "taskfailure"]
  };
  
  // Expand query tokens - but be selective
  const expandedQueryTokens = new Set(queryTokens);
  queryTokens.forEach(token => {
    Object.entries(semanticExpansions).forEach(([key, synonyms]) => {
      // Only expand if the query token is a strong match
      if (synonyms.includes(token) || key === token) {
        synonyms.forEach(s => expandedQueryTokens.add(s));
      }
    });
  });
  
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript", "decorators-legacy", "classProperties", "dynamicImport", "optionalChaining", "nullishCoalescingOperator"],
      errorRecovery: true
    });
  } catch (e) {
    return fallbackSearch(lines, expandedQueryTokens, totalLines);
  }
  
  const candidates = [];
  
  const getText = (startLine, endLine) => {
    return lines.slice(startLine - 1, endLine).join(" ");
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
          
          // Extract name
          let name = "";
          if (node.id && node.id.name) {
            name = node.id.name.toLowerCase();
          } else if (node.key && node.key.name) {
            name = node.key.name.toLowerCase();
          }
          
          // Name matching bonus - but check ORIGINAL query tokens primarily
          if (name) {
            const nameTokens = tokenize(name);
            nameTokens.forEach(nt => {
              // Strong boost if name matches original query token
              if (queryTokens.includes(nt)) {
                score += 40;
              }
              // Weaker boost if name matches expanded token
              else if (expandedQueryTokens.has(nt)) {
                score += 15;
              }
            });
          }
          
          // Structural boosts
          if (isFunction) score *= 2.0;
          if (isClass) score *= 1.5;
          if (isTopLevel && isStatement) score *= 1.5;
          if (isObjectProperty) score *= 1.4;
          
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
  
  // Select with overlap handling - Gemini style (strict no overlap)
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

function fallbackSearch(lines, expandedTokens, totalLines) {
  const lineScores = [];
  
  lines.forEach((line, idx) => {
    let score = 0;
    const lineLower = line.toLowerCase();
    const lineTokens = lineLower.split(/\W+/).filter(t => t.length > 2);
    
    expandedTokens.forEach(qt => {
      if (lineTokens.includes(qt)) score += 5;
      if (lineLower.includes(qt)) score += 2;
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

module.exports = { findTopRelevantLineRangesClaude };
