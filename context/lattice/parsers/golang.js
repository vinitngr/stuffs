/**
 * Go/Golang Parser v3
 * Clean structured output for RAG pipelines
 * Parses Go source files (.go)
 */

class GolangParser3 {
  async parse(content, filePath) {
    const path = require('path');
    const lines = content.split('\n');
    
    const rawImports = this._extractImports(content);
    const imports = this._formatImports(rawImports);
    const importMap = this._buildImportMap(imports);
    const packageName = this._extractPackage(content);
    
    return {
      file: {
        path: filePath,
        name: path.basename(filePath),
        language: 'go',
        package: packageName,
        lines: lines.length,
        sizeBytes: content.length,
      },
      imports,
      exports: this._extractExports(content, lines),
      chunks: [
        ...this._extractStructs(content, lines, importMap),
        ...this._extractInterfaces(content, lines, importMap),
        ...this._extractFunctions(content, lines, importMap),
      ].sort((a, b) => a.location.startLine - b.location.startLine),
    };
  }

  _extractPackage(content) {
    const match = /^package\s+(\w+)/m.exec(content);
    return match ? match[1] : 'main';
  }

  _buildImportMap(formattedImports) {
    const map = {};
    for (const [source, info] of Object.entries(formattedImports)) {
      for (const sym of (info.symbols || [])) {
        map[sym] = { source, kind: info.kind };
      }
    }
    return map;
  }

  _formatImports(rawImports) {
    const imports = {};
    
    for (const imp of rawImports) {
      const symbols = [];
      if (imp.alias) symbols.push(imp.alias);
      else {
        // Use last part of path as default symbol
        const parts = imp.source.split('/');
        symbols.push(parts[parts.length - 1]);
      }
      
      imports[imp.source] = {
        kind: this._classifyImport(imp.source),
        symbols,
        alias: imp.alias || null,
      };
    }
    
    return imports;
  }

  _classifyImport(source) {
    // Standard library packages
    const stdLib = [
      'fmt', 'os', 'io', 'log', 'net', 'http', 'html', 'json', 'xml',
      'strings', 'strconv', 'bytes', 'bufio', 'regexp', 'unicode',
      'time', 'math', 'rand', 'sort', 'sync', 'atomic', 'context',
      'errors', 'flag', 'path', 'filepath', 'runtime', 'reflect',
      'encoding', 'crypto', 'hash', 'compress', 'archive',
      'database', 'sql', 'testing', 'debug', 'embed', 'plugin',
      'syscall', 'unsafe', 'cgo', 'expvar', 'image', 'index',
      'container', 'go', 'text', 'mime', 'net/http', 'io/ioutil',
      'encoding/json', 'encoding/xml', 'path/filepath', 'database/sql',
    ];
    
    // Check if it's a standard library import
    const basePkg = source.split('/')[0];
    if (stdLib.includes(basePkg) || stdLib.includes(source)) {
      return 'native';
    }
    
    // Local imports (relative or same module)
    if (source.startsWith('.') || source.startsWith('./') || source.startsWith('../')) {
      return 'local';
    }
    
    // Check for common module patterns
    if (source.includes('.')) {
      return 'external'; // github.com/..., golang.org/..., etc.
    }
    
    return 'native';
  }

  _extractImports(content) {
    const imports = [];

    // Single import: import "fmt"
    const singleRegex = /^import\s+(?:(\w+)\s+)?["']([^"']+)["']/gm;
    let match;
    while ((match = singleRegex.exec(content)) !== null) {
      imports.push({
        source: match[2],
        alias: match[1] || null,
      });
    }

    // Import block: import ( ... )
    const blockRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    while ((match = blockRegex.exec(content)) !== null) {
      const block = match[1];
      const lineRegex = /(?:(\w+)\s+)?["']([^"']+)["']/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        imports.push({
          source: lineMatch[2],
          alias: lineMatch[1] || null,
        });
      }
    }

    return imports;
  }

  _extractExports(content, lines) {
    const exports = [];
    
    // In Go, exported identifiers start with uppercase letter
    // Extract exported types, functions, variables, constants
    
    // Exported types (struct, interface)
    const typeRegex = /^type\s+([A-Z]\w*)\s+(?:struct|interface)/gm;
    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Exported functions
    const funcRegex = /^func\s+(?:\([^)]+\)\s+)?([A-Z]\w*)\s*\(/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      if (!exports.includes(match[1])) exports.push(match[1]);
    }

    // Exported variables and constants
    const varRegex = /^(?:var|const)\s+([A-Z]\w*)\s/gm;
    while ((match = varRegex.exec(content)) !== null) {
      if (!exports.includes(match[1])) exports.push(match[1]);
    }

    return exports;
  }

  _extractStructs(content, lines, importMap) {
    const chunks = [];
    const structRegex = /^type\s+(\w+)\s+struct\s*\{/gm;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const name = match[1];
      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const fields = this._extractStructFields(code);
      const methods = this._extractMethods(content, lines, name, importMap);
      const importsUsed = this._findUsedImports(code, importMap);

      chunks.push({
        id: name,
        type: 'struct',
        role: this._classifyRole(name),
        isExported: /^[A-Z]/.test(name),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: code.length },
        doc: doc ? this._cleanDoc(doc) : null,
        fields,
        dependencies: { importsUsed },
        methods,
        content: code,
      });
    }

    return chunks;
  }

  _extractStructFields(code) {
    const fields = [];
    const lines = code.split('\n').slice(1, -1); // Remove type declaration and closing brace
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      
      // field Type `tag`
      const fieldMatch = /^(\w+)\s+(\S+)(?:\s+`([^`]+)`)?/.exec(trimmed);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
          tag: fieldMatch[3] || null,
          isExported: /^[A-Z]/.test(fieldMatch[1]),
        });
      }
      
      // Embedded type
      const embeddedMatch = /^(\*?\w+(?:\.\w+)?)(?:\s+`([^`]+)`)?$/.exec(trimmed);
      if (embeddedMatch && !fieldMatch) {
        fields.push({
          name: embeddedMatch[1].replace('*', ''),
          type: embeddedMatch[1],
          tag: embeddedMatch[2] || null,
          isEmbedded: true,
        });
      }
    }
    
    return fields;
  }

  _extractInterfaces(content, lines, importMap) {
    const chunks = [];
    const interfaceRegex = /^type\s+(\w+)\s+interface\s*\{/gm;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const name = match[1];
      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const methods = this._extractInterfaceMethods(code);
      const importsUsed = this._findUsedImports(code, importMap);

      chunks.push({
        id: name,
        type: 'interface',
        role: this._classifyRole(name),
        isExported: /^[A-Z]/.test(name),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: code.length },
        doc: doc ? this._cleanDoc(doc) : null,
        dependencies: { importsUsed },
        methods,
        content: code,
      });
    }

    return chunks;
  }

  _extractInterfaceMethods(code) {
    const methods = [];
    const lines = code.split('\n').slice(1, -1);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      
      // MethodName(params) returns
      const methodMatch = /^(\w+)\s*\(([^)]*)\)\s*(.*)$/.exec(trimmed);
      if (methodMatch) {
        methods.push({
          name: methodMatch[1],
          params: this._parseParams(methodMatch[2]),
          returns: methodMatch[3].trim() || null,
          isExported: /^[A-Z]/.test(methodMatch[1]),
        });
      }
    }
    
    return methods;
  }

  _extractMethods(content, lines, structName, importMap) {
    const methods = [];
    // func (r *Receiver) MethodName(params) returns { ... }
    const methodRegex = new RegExp(
      `^func\\s+\\(\\s*(\\w+)\\s+(\\*?${structName})\\s*\\)\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*([^{]*)\\s*\\{`,
      'gm'
    );
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const receiverName = match[1];
      const receiverType = match[2];
      const methodName = match[3];
      const params = match[4];
      const returns = match[5].trim();
      
      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const methodCode = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const inputs = this._parseParams(params);
      const output = this._parseReturns(returns);
      const { localCalls, externalCalls } = this._analyzeCalls(methodCode, importMap);
      const importsUsed = this._findUsedImports(methodCode, importMap);
      const behavior = this._analyzeBehavior(methodCode);

      methods.push({
        id: `${structName}.${methodName}`,
        name: methodName,
        receiver: { name: receiverName, type: receiverType, isPointer: receiverType.startsWith('*') },
        isExported: /^[A-Z]/.test(methodName),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: methodCode.length },
        doc: doc ? this._cleanDoc(doc) : null,
        io: { inputs, output },
        dependencies: { localCalls, externalCalls },
        importsUsed,
        behavior,
        content: methodCode,
      });
    }

    return methods;
  }

  _extractFunctions(content, lines, importMap) {
    const chunks = [];
    const seen = new Set();

    // Standalone functions (not methods)
    const funcRegex = /^func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*([^{]*)\s*\{/gm;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);

      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const inputs = this._parseParams(match[2]);
      const output = this._parseReturns(match[3].trim());
      const { localCalls, externalCalls } = this._analyzeCalls(code, importMap);
      const importsUsed = this._findUsedImports(code, importMap);
      const behavior = this._analyzeBehavior(code);

      chunks.push({
        id: name,
        type: 'function',
        role: this._classifyFuncRole(name),
        isExported: /^[A-Z]/.test(name),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: code.length },
        doc: doc ? this._cleanDoc(doc) : null,
        io: { inputs, output },
        dependencies: { localCalls, externalCalls },
        importsUsed,
        behavior,
        content: code,
      });
    }

    return chunks;
  }

  _parseParams(paramStr) {
    if (!paramStr?.trim()) return [];
    
    const params = [];
    // Handle grouped params: a, b int, c string
    const parts = paramStr.split(',');
    let pendingNames = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Check if this part has a type
      const match = /^(\w+)\s+(.+)$/.exec(trimmed);
      if (match) {
        // This part has name and type
        // Apply type to any pending names
        for (const name of pendingNames) {
          params.push({ name, type: match[2] });
        }
        pendingNames = [];
        params.push({ name: match[1], type: match[2] });
      } else {
        // Just a name, type comes later
        pendingNames.push(trimmed);
      }
    }
    
    return params;
  }

  _parseReturns(returnStr) {
    if (!returnStr?.trim()) return { type: 'void' };
    
    let str = returnStr.trim();
    
    // Multiple returns: (Type1, Type2, error)
    if (str.startsWith('(') && str.endsWith(')')) {
      str = str.slice(1, -1);
      const types = str.split(',').map(t => {
        const parts = t.trim().split(/\s+/);
        return parts.length > 1 ? { name: parts[0], type: parts[1] } : { type: parts[0] };
      });
      return { type: 'tuple', types };
    }
    
    // Named return: name Type
    const namedMatch = /^(\w+)\s+(\S+)$/.exec(str);
    if (namedMatch) {
      return { name: namedMatch[1], type: namedMatch[2] };
    }
    
    // Simple return type
    return { type: str };
  }

  _analyzeCalls(code, importMap) {
    const localCalls = [];
    const externalCalls = [];
    const seen = new Set();
    
    const callRegex = /(\w+(?:\.\w+)?)\s*\(/g;
    const ignore = ['if', 'for', 'switch', 'select', 'go', 'defer', 'return', 'func', 
                    'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close',
                    'panic', 'recover', 'print', 'println', 'complex', 'real', 'imag'];
    
    let match;
    while ((match = callRegex.exec(code)) !== null) {
      const name = match[1];
      const base = name.split('.')[0];
      
      if (ignore.includes(base) || seen.has(name)) continue;
      seen.add(name);
      
      const imp = importMap[base];
      if (imp) {
        externalCalls.push(name);
      } else if (!/^[A-Z]/.test(base)) {
        localCalls.push(name);
      }
    }

    return { localCalls, externalCalls };
  }

  _findUsedImports(code, importMap) {
    const used = [];
    for (const [name, info] of Object.entries(importMap)) {
      if (new RegExp(`\\b${name}\\b`).test(code)) {
        used.push(name);
      }
    }
    return used;
  }

  _analyzeBehavior(code) {
    const sideEffects = [];
    
    if (/fmt\.Print|log\.\w+/.test(code)) sideEffects.push('logging');
    if (/\.Write\(|http\.ResponseWriter|w\.Write/.test(code)) sideEffects.push('http-response');
    if (/http\.Get|http\.Post|http\.Client|net\.Dial/.test(code)) sideEffects.push('network');
    if (/os\.Open|os\.Create|ioutil\.|bufio\.|io\./.test(code)) sideEffects.push('file-io');
    if (/time\.Sleep|time\.After|time\.Tick/.test(code)) sideEffects.push('timing');
    if (/\bgo\s+\w+|<-|chan\s/.test(code)) sideEffects.push('concurrency');
    if (/sql\.|\.Query|\.Exec|\.Begin/.test(code)) sideEffects.push('database');
    if (/context\./.test(code)) sideEffects.push('context');
    
    const mutatesState = /\.\w+\s*=/.test(code) || /\[\w+\]\s*=/.test(code);

    return { sideEffects, mutatesState };
  }

  // Helpers
  _lineNum(content, index) {
    return content.slice(0, index).split('\n').length;
  }

  _blockEnd(lines, start) {
    let depth = 0, started = false;
    for (let i = start; i < lines.length; i++) {
      for (const c of lines[i]) {
        if (c === '{') { depth++; started = true; }
        else if (c === '}') { depth--; if (started && depth === 0) return i + 1; }
      }
    }
    return lines.length;
  }

  _docAbove(lines, lineIdx) {
    let i = lineIdx - 1;
    let docLines = [];
    
    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('//')) {
        docLines.unshift(line);
        i--;
      } else if (line === '') {
        i--;
      } else {
        break;
      }
    }
    
    return docLines.length > 0 ? docLines.join('\n') : null;
  }

  _cleanDoc(doc) {
    return doc
      .split('\n')
      .map(line => line.replace(/^\/\/\s?/, ''))
      .join(' ')
      .trim();
  }

  _classifyRole(name) {
    const n = name.toLowerCase();
    if (n.includes('controller') || n.includes('handler')) return 'controller';
    if (n.includes('service') || n.includes('manager')) return 'service';
    if (n.includes('util') || n.includes('helper')) return 'utility';
    if (n.includes('config') || n.includes('option')) return 'config';
    if (n.includes('model') || n.includes('entity')) return 'model';
    if (n.includes('repo') || n.includes('store')) return 'repository';
    if (n.includes('client')) return 'client';
    if (n.includes('server')) return 'server';
    if (n.includes('middleware')) return 'middleware';
    if (n.includes('request') || n.includes('response')) return 'dto';
    if (n.includes('error') || n.includes('err')) return 'error';
    return 'module';
  }

  _classifyFuncRole(name) {
    const n = name.toLowerCase();
    if (n.startsWith('get') || n.startsWith('fetch') || n.startsWith('load') || n.startsWith('read')) return 'getter';
    if (n.startsWith('set') || n.startsWith('update') || n.startsWith('save') || n.startsWith('write')) return 'setter';
    if (n.startsWith('handle') || n.startsWith('on')) return 'handler';
    if (n.startsWith('new') || n.startsWith('create') || n.startsWith('make')) return 'factory';
    if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can') || n.startsWith('validate')) return 'validator';
    if (n.startsWith('parse') || n.startsWith('format') || n.startsWith('convert') || n.startsWith('to')) return 'transformer';
    if (n.includes('init') || n.includes('setup') || n.includes('bootstrap')) return 'initializer';
    if (n.startsWith('test')) return 'test';
    if (n === 'main') return 'entrypoint';
    return 'utility';
  }
}

module.exports = GolangParser3;
