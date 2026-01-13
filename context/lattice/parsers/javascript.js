/**
 * JavaScript/TypeScript Parser v3
 * Clean structured output for RAG pipelines
 */

class JavaScriptParser3 {
  async parse(content, filePath) {
    const path = require('path');
    const lines = content.split('\n');
    
    const rawImports = this._extractImports(content);
    const imports = this._formatImports(rawImports);
    const importMap = this._buildImportMap(imports);
    
    return {
      file: {
        path: filePath,
        name: path.basename(filePath),
        language: /\.tsx?$/.test(filePath) ? 'typescript' : 'javascript',
        moduleType: /import\s/.test(content) ? 'esm' : 'commonjs',
        lines: lines.length,
        sizeBytes: content.length,
      },
      imports,
      exports: this._extractExports(content),
      chunks: [
        ...this._extractClasses(content, lines, importMap),
        ...this._extractFunctions(content, lines, importMap),
        ...this._extractObjects(content, lines, importMap),
      ].sort((a, b) => a.location.startLine - b.location.startLine),
    };
  }

  _buildImportMap(formattedImports) {
    const map = {};
    for (const [source, info] of Object.entries(formattedImports)) {
      for (const sym of (info.symbols || [])) {
        const cleanSym = sym.replace('* as ', '');
        map[cleanSym] = { source, kind: info.kind };
      }
    }
    return map;
  }

  _formatImports(rawImports) {
    const imports = {};
    
    for (const imp of rawImports) {
      const symbols = [];
      if (imp.default) symbols.push(imp.default);
      if (imp.named) symbols.push(...imp.named);
      if (imp.namespace) symbols.push(`* as ${imp.namespace}`);
      
      imports[imp.source] = {
        kind: imp.source.startsWith('.') ? 'local' : (this._isNative(imp.source) ? 'native' : 'external'),
        symbols,
      };
    }
    
    return imports;
  }

  _isNative(source) {
    return ['fs', 'path', 'os', 'http', 'https', 'url', 'util', 'crypto', 
            'stream', 'events', 'buffer', 'child_process', 'net', 'dns'].includes(source);
  }

  _extractClasses(content, lines, importMap) {
    const chunks = [];
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const methods = this._extractMethods(code, startLine, match[1], importMap);
      const importsUsed = this._findUsedImports(code, importMap);

      chunks.push({
        id: match[1],
        type: 'class',
        role: this._classifyRole(match[1]),
        extends: match[2] || null,
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

  _extractMethods(classCode, classStart, className, importMap) {
    const methods = [];
    const methodRegex = /(?:(async)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
    let match;

    while ((match = methodRegex.exec(classCode)) !== null) {
      const name = match[2];
      if (['if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;

      const relLine = this._lineNum(classCode, match.index);
      const startLine = classStart + relLine - 1;
      
      const methodLines = classCode.slice(match.index).split('\n');
      const endLine = startLine + this._blockEnd(methodLines, 0) - 1;
      const methodCode = methodLines.slice(0, this._blockEnd(methodLines, 0)).join('\n');
      
      const inputs = this._parseInputs(match[3], importMap);
      const output = match[4]?.trim() || this._inferReturn(methodCode);
      const { localCalls, externalCalls } = this._analyzeCalls(methodCode, importMap);
      const importsUsed = this._findUsedImports(methodCode, importMap);
      const behavior = this._analyzeBehavior(methodCode);

      methods.push({
        id: `${className}.${name}`,
        name,
        isAsync: !!match[1],
        isPrivate: name.startsWith('_'),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: methodCode.length },
        io: { inputs, output: { type: output } },
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

    // Function declarations
    const funcRegex = /(?:^|[^.])\b(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/gm;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[2];
      if (seen.has(name)) continue;
      seen.add(name);

      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const inputs = this._parseInputs(match[3], importMap);
      const output = match[4]?.trim() || this._inferReturn(code);
      const { localCalls, externalCalls } = this._analyzeCalls(code, importMap);
      const importsUsed = this._findUsedImports(code, importMap);
      const behavior = this._analyzeBehavior(code);

      chunks.push({
        id: name,
        type: 'function',
        role: this._classifyFuncRole(name),
        isAsync: !!match[1],
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: code.length },
        doc: doc ? this._cleanDoc(doc) : null,
        io: { inputs, output: { type: output } },
        dependencies: { localCalls, externalCalls },
        importsUsed,
        behavior,
        content: code,
      });
    }

    // Arrow functions
    const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/g;

    while ((match = arrowRegex.exec(content)) !== null) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);

      const startLine = this._lineNum(content, match.index);
      const afterArrow = content.slice(match.index + match[0].length).trim();
      let endLine = afterArrow.startsWith('{') 
        ? this._blockEnd(lines, startLine - 1)
        : this._stmtEnd(lines, startLine - 1);
      
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const inputs = this._parseInputs(match[3], importMap);
      const output = match[4]?.trim() || this._inferReturn(code);
      const { localCalls, externalCalls } = this._analyzeCalls(code, importMap);
      const importsUsed = this._findUsedImports(code, importMap);
      const behavior = this._analyzeBehavior(code);

      chunks.push({
        id: name,
        type: 'function',
        role: this._classifyFuncRole(name),
        isAsync: !!match[2],
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: code.length },
        doc: doc ? this._cleanDoc(doc) : null,
        io: { inputs, output: { type: output } },
        dependencies: { localCalls, externalCalls },
        importsUsed,
        behavior,
        content: code,
      });
    }

    return chunks;
  }

  _extractObjects(content, lines, importMap) {
    const chunks = [];
    const objRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\{/g;
    let match;

    while ((match = objRegex.exec(content)) !== null) {
      const name = match[1];
      const startLine = this._lineNum(content, match.index);
      
      // Skip nested objects
      const indent = lines[startLine - 1].match(/^\s*/)[0].length;
      if (indent > 2) continue;

      const endLine = this._blockEnd(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._docAbove(lines, startLine - 1);
      
      const methods = this._extractObjectMethods(code, startLine, name, importMap);
      const importsUsed = this._findUsedImports(code, importMap);

      chunks.push({
        id: name,
        type: 'object',
        role: this._classifyRole(name),
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

  _extractObjectMethods(code, objStart, objName, importMap) {
    const methods = [];
    const methodRegex = /(\w+)\s*(?::\s*(async\s+)?(?:function\s*)?\(([^)]*)\)|\(([^)]*)\)\s*=>)/g;
    let match;

    while ((match = methodRegex.exec(code)) !== null) {
      const name = match[1];
      if (['if', 'for', 'return'].includes(name)) continue;

      const relLine = this._lineNum(code, match.index);
      const inputs = this._parseInputs(match[3] || match[4] || '', importMap);

      methods.push({
        id: `${objName}.${name}`,
        name,
        isAsync: !!match[2],
        location: { startLine: objStart + relLine - 1 },
        io: { inputs },
      });
    }

    return methods;
  }

  _parseInputs(paramStr, importMap) {
    if (!paramStr?.trim()) return [];
    
    return paramStr.split(',').map(p => {
      const trimmed = p.trim();
      if (!trimmed) return null;
      
      // TS: name: Type
      const tsMatch = /(\w+)\s*\??\s*:\s*([^=]+)/.exec(trimmed);
      if (tsMatch) {
        const type = tsMatch[2].trim();
        const imp = importMap[type];
        return {
          name: tsMatch[1],
          type,
          source: imp?.source || null,
        };
      }
      
      // JS with default
      const defMatch = /(\w+)\s*=/.exec(trimmed);
      if (defMatch) return { name: defMatch[1], type: null };
      
      return { name: trimmed, type: null };
    }).filter(Boolean);
  }

  _analyzeCalls(code, importMap) {
    const localCalls = [];
    const externalCalls = [];
    const seen = new Set();
    
    const callRegex = /(?:this\.)?(\w+(?:\.\w+)?)\s*\(/g;
    const ignore = ['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 
                    'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Promise', 'Date', 'Error', 'Map', 'Set'];
    
    let match;
    while ((match = callRegex.exec(code)) !== null) {
      const name = match[1];
      const base = name.split('.')[0];
      
      if (ignore.includes(base) || seen.has(name)) continue;
      seen.add(name);
      
      const imp = importMap[base];
      if (imp) {
        externalCalls.push(name);
      } else if (!/^[A-Z]/.test(base) || base === 'this') {
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
    
    if (/console\.\w+/.test(code)) sideEffects.push('logging');
    if (/res\.(json|send|status|redirect)/.test(code)) sideEffects.push('http-response');
    if (/fetch|axios|http\./.test(code)) sideEffects.push('network');
    if (/fs\.\w+|writeFile|readFile/.test(code)) sideEffects.push('file-io');
    if (/setTimeout|setInterval/.test(code)) sideEffects.push('timing');
    if (/\.emit\(|\.on\(/.test(code)) sideEffects.push('events');
    
    const mutatesState = /this\.\w+\s*=/.test(code) || /\.push\(|\.pop\(|\.splice\(|\.shift\(/.test(code);

    return { sideEffects, mutatesState };
  }

  _inferReturn(code) {
    if (/async\s/.test(code)) {
      const ret = /return\s+(.+?);/.exec(code);
      if (ret) {
        if (/^\{/.test(ret[1])) return 'Promise<object>';
        if (/^\[/.test(ret[1])) return 'Promise<array>';
        if (/^['"`]/.test(ret[1])) return 'Promise<string>';
        if (/^\d/.test(ret[1])) return 'Promise<number>';
        if (/^(true|false)/.test(ret[1])) return 'Promise<boolean>';
      }
      return 'Promise<any>';
    }
    
    const ret = /return\s+(.+?);/.exec(code);
    if (ret) {
      if (/^\{/.test(ret[1])) return 'object';
      if (/^\[/.test(ret[1])) return 'array';
      if (/^['"`]/.test(ret[1])) return 'string';
      if (/^\d/.test(ret[1])) return 'number';
      if (/^(true|false)/.test(ret[1])) return 'boolean';
    }
    
    return /return\s/.test(code) ? 'any' : 'void';
  }

  _extractImports(content) {
    const imports = [];

    // ESM
    const esmRegex = /import\s+(?:(?:\{([^}]+)\})|(?:(\w+)(?:\s*,\s*\{([^}]+)\})?)|(?:\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = esmRegex.exec(content)) !== null) {
      const named = [...(match[1] || '').split(','), ...(match[3] || '').split(',')].map(s => s.trim()).filter(Boolean);
      imports.push({
        source: match[5],
        default: match[2] || null,
        named: named.length ? named : null,
        namespace: match[4] || null,
      });
    }

    // CommonJS
    const cjsRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = cjsRegex.exec(content)) !== null) {
      imports.push({
        source: match[3],
        default: match[2] || null,
        named: match[1] ? match[1].split(',').map(s => s.trim()) : null,
        namespace: null,
      });
    }

    return imports;
  }

  _extractExports(content) {
    const exports = [];
    
    const namedRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    let match;
    while ((match = namedRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    const defMatch = /export\s+default\s+(?:class|function|async\s+function)?\s*(\w+)?/.exec(content);
    if (defMatch) exports.push(defMatch[1] || 'default');

    const cjsMatch = /module\.exports\s*=\s*(\w+)/.exec(content);
    if (cjsMatch) exports.push(cjsMatch[1]);

    return exports;
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

  _stmtEnd(lines, start) {
    for (let i = start; i < lines.length; i++) {
      if (lines[i].includes(';') || lines[i].trim() === '') return i + 1;
    }
    return start + 1;
  }

  _docAbove(lines, lineIdx) {
    let i = lineIdx - 1;
    while (i >= 0 && lines[i].trim() === '') i--;
    if (i < 0 || !lines[i].includes('*/')) return null;
    let start = i;
    while (start >= 0 && !lines[start].includes('/**')) start--;
    if (start < 0) return null;
    return lines.slice(start, i + 1).join('\n');
  }

  _cleanDoc(doc) {
    return doc.replace(/\/\*\*|\*\/|\s*\*\s*/g, ' ').replace(/@\w+[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  }

  _classifyRole(name) {
    const n = name.toLowerCase();
    if (n.includes('controller') || n.includes('handler')) return 'controller';
    if (n.includes('service') || n.includes('manager')) return 'service';
    if (n.includes('util') || n.includes('helper')) return 'utility';
    if (n.includes('config')) return 'config';
    if (n.includes('model')) return 'model';
    if (n.includes('route')) return 'router';
    return 'module';
  }

  _classifyFuncRole(name) {
    const n = name.toLowerCase();
    if (n.startsWith('get') || n.startsWith('fetch') || n.startsWith('load')) return 'getter';
    if (n.startsWith('set') || n.startsWith('update') || n.startsWith('save')) return 'setter';
    if (n.startsWith('handle') || n.startsWith('on')) return 'handler';
    if (n.startsWith('create') || n.startsWith('make')) return 'factory';
    if (n.startsWith('validate') || n.startsWith('check')) return 'validator';
    if (n.startsWith('parse') || n.startsWith('format')) return 'transformer';
    if (n.includes('init') || n.includes('setup')) return 'initializer';
    return 'utility';
  }
}

module.exports = JavaScriptParser3;
