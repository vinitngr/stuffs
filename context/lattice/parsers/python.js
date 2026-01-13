/**
 * Python Parser v3
 * Clean structured output for RAG pipelines
 * Parses Python source files (.py)
 */

class PythonParser3 {
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
        language: 'python',
        moduleType: this._detectModuleType(content),
        lines: lines.length,
        sizeBytes: content.length,
      },
      imports,
      exports: this._extractExports(content, lines),
      chunks: [
        ...this._extractClasses(content, lines, importMap),
        ...this._extractFunctions(content, lines, importMap),
      ].sort((a, b) => a.location.startLine - b.location.startLine),
    };
  }

  _detectModuleType(content) {
    // Check for common patterns
    if (/__name__\s*==\s*['"]__main__['"]/.test(content)) return 'script';
    if (/^from\s+\.|^import\s+\./.test(content)) return 'package';
    return 'module';
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
        kind: imp.source.startsWith('.') ? 'local' : (this._isStdLib(imp.source) ? 'native' : 'external'),
        symbols,
      };
    }
    
    return imports;
  }

  _isStdLib(source) {
    const stdLibModules = [
      'os', 'sys', 'io', 're', 'json', 'math', 'time', 'datetime', 'random',
      'collections', 'itertools', 'functools', 'operator', 'typing', 'types',
      'pathlib', 'shutil', 'glob', 'fnmatch', 'tempfile', 'fileinput',
      'subprocess', 'multiprocessing', 'threading', 'concurrent', 'asyncio',
      'socket', 'ssl', 'http', 'urllib', 'email', 'html', 'xml',
      'logging', 'warnings', 'traceback', 'inspect', 'dis', 'gc',
      'pickle', 'shelve', 'sqlite3', 'csv', 'configparser',
      'hashlib', 'hmac', 'secrets', 'base64', 'binascii',
      'copy', 'pprint', 'enum', 'dataclasses', 'abc', 'contextlib',
      'unittest', 'doctest', 'pytest', 'string', 'textwrap',
      'struct', 'codecs', 'unicodedata', 'argparse', 'getopt',
      'uuid', 'decimal', 'fractions', 'statistics', 'cmath',
      'array', 'heapq', 'bisect', 'weakref', 'queue',
      'atexit', 'signal', 'errno', 'ctypes', 'platform',
    ];
    const baseMod = source.split('.')[0];
    return stdLibModules.includes(baseMod);
  }

  _extractImports(content) {
    const imports = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and strings
      if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) continue;

      // from X import Y, Z
      const fromMatch = /^from\s+([\w.]+)\s+import\s+(.+)$/.exec(trimmed);
      if (fromMatch) {
        const source = fromMatch[1];
        const importPart = fromMatch[2].replace(/#.*$/, '').trim();
        
        if (importPart === '*') {
          imports.push({
            source,
            default: null,
            named: null,
            namespace: source.split('.').pop(),
          });
        } else {
          const named = importPart.split(',').map(s => {
            const asMatch = /(\w+)\s+as\s+(\w+)/.exec(s.trim());
            return asMatch ? asMatch[2] : s.trim().split(' ')[0];
          }).filter(Boolean);
          
          imports.push({
            source,
            default: null,
            named,
            namespace: null,
          });
        }
        continue;
      }

      // import X, Y or import X as Y
      const importMatch = /^import\s+(.+)$/.exec(trimmed);
      if (importMatch) {
        const parts = importMatch[1].replace(/#.*$/, '').split(',');
        
        for (const part of parts) {
          const asMatch = /(\S+)\s+as\s+(\w+)/.exec(part.trim());
          if (asMatch) {
            imports.push({
              source: asMatch[1],
              default: asMatch[2],
              named: null,
              namespace: null,
            });
          } else {
            const modName = part.trim();
            if (modName) {
              imports.push({
                source: modName,
                default: modName.split('.').pop(),
                named: null,
                namespace: null,
              });
            }
          }
        }
      }
    }

    return imports;
  }

  _extractExports(content, lines) {
    const exports = [];
    
    // __all__ definition
    const allMatch = /__all__\s*=\s*\[([^\]]+)\]/.exec(content);
    if (allMatch) {
      const items = allMatch[1].match(/['"](\w+)['"]/g) || [];
      return items.map(s => s.replace(/['"]/g, ''));
    }

    // Top-level classes and functions (public by convention - no leading underscore)
    const classRegex = /^class\s+(\w+)/gm;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      if (!match[1].startsWith('_')) exports.push(match[1]);
    }

    const funcRegex = /^def\s+(\w+)/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      if (!match[1].startsWith('_')) exports.push(match[1]);
    }

    return [...new Set(exports)];
  }

  _extractClasses(content, lines, importMap) {
    const chunks = [];
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEndPython(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._extractDocstring(code);
      
      // Parse inheritance
      const bases = match[2] ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [];
      const extendsClass = bases.length > 0 ? bases[0] : null;
      
      const methods = this._extractMethods(code, startLine, match[1], importMap);
      const importsUsed = this._findUsedImports(code, importMap);

      chunks.push({
        id: match[1],
        type: 'class',
        role: this._classifyRole(match[1]),
        extends: extendsClass,
        bases,
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
    const methodRegex = /^(\s+)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/gm;
    let match;

    while ((match = methodRegex.exec(classCode)) !== null) {
      const indent = match[1];
      const name = match[3];
      
      // Skip nested functions (more than one level of indentation from class)
      if (indent.length > 8) continue;

      const relLine = this._lineNum(classCode, match.index);
      const startLine = classStart + relLine - 1;
      
      const methodLines = classCode.slice(match.index).split('\n');
      const methodEndRel = this._methodEndPython(methodLines);
      const endLine = startLine + methodEndRel - 1;
      const methodCode = methodLines.slice(0, methodEndRel).join('\n');
      
      const inputs = this._parseInputs(match[4], importMap);
      const output = match[5]?.trim() || this._inferReturnPython(methodCode);
      const { localCalls, externalCalls } = this._analyzeCalls(methodCode, importMap);
      const importsUsed = this._findUsedImports(methodCode, importMap);
      const behavior = this._analyzeBehavior(methodCode);
      const doc = this._extractDocstring(methodCode);

      methods.push({
        id: `${className}.${name}`,
        name,
        isAsync: !!match[2],
        isPrivate: name.startsWith('_') && !name.startsWith('__'),
        isSpecial: name.startsWith('__') && name.endsWith('__'),
        location: { startLine, endLine },
        size: { lines: endLine - startLine + 1, bytes: methodCode.length },
        doc: doc ? this._cleanDoc(doc) : null,
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

    // Top-level function definitions only
    const funcRegex = /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/gm;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[2];
      if (seen.has(name)) continue;
      
      // Skip if this is a method inside a class (has indentation)
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineContent = content.slice(lineStart, match.index);
      if (/^\s+/.test(lineContent)) continue;
      
      seen.add(name);

      const startLine = this._lineNum(content, match.index);
      const endLine = this._blockEndPython(lines, startLine - 1);
      const code = lines.slice(startLine - 1, endLine).join('\n');
      const doc = this._extractDocstring(code);
      
      const inputs = this._parseInputs(match[3], importMap);
      const output = match[4]?.trim() || this._inferReturnPython(code);
      const { localCalls, externalCalls } = this._analyzeCalls(code, importMap);
      const importsUsed = this._findUsedImports(code, importMap);
      const behavior = this._analyzeBehavior(code);
      
      // Check for decorators
      const decorators = this._extractDecorators(lines, startLine - 1);

      chunks.push({
        id: name,
        type: 'function',
        role: this._classifyFuncRole(name, decorators),
        isAsync: !!match[1],
        decorators,
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

  _extractDecorators(lines, funcLineIdx) {
    const decorators = [];
    let i = funcLineIdx - 1;
    
    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('@')) {
        const match = /@(\w+)(?:\([^)]*\))?/.exec(line);
        if (match) decorators.unshift(match[1]);
        i--;
      } else if (line === '' || line.startsWith('#')) {
        i--;
      } else {
        break;
      }
    }
    
    return decorators;
  }

  _parseInputs(paramStr, importMap) {
    if (!paramStr?.trim()) return [];
    
    // Handle multi-line params
    paramStr = paramStr.replace(/\n/g, ' ');
    
    const params = [];
    let depth = 0;
    let current = '';
    
    for (const char of paramStr) {
      if (char === '(' || char === '[' || char === '{') depth++;
      else if (char === ')' || char === ']' || char === '}') depth--;
      else if (char === ',' && depth === 0) {
        if (current.trim()) params.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) params.push(current.trim());

    return params.map(p => {
      const trimmed = p.trim();
      if (!trimmed || trimmed === 'self' || trimmed === 'cls') return null;
      
      // *args, **kwargs
      if (trimmed.startsWith('**')) {
        return { name: trimmed.slice(2).split(':')[0].trim(), type: 'dict', isKwargs: true };
      }
      if (trimmed.startsWith('*')) {
        return { name: trimmed.slice(1).split(':')[0].trim(), type: 'tuple', isArgs: true };
      }
      
      // Type annotated: name: Type = default
      const typeMatch = /^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/.exec(trimmed);
      if (typeMatch) {
        const type = typeMatch[2].trim();
        const imp = importMap[type];
        return {
          name: typeMatch[1],
          type,
          source: imp?.source || null,
          default: typeMatch[3]?.trim() || null,
        };
      }
      
      // With default value: name = default
      const defMatch = /^(\w+)\s*=\s*(.+)$/.exec(trimmed);
      if (defMatch) {
        return { name: defMatch[1], type: this._inferTypeFromValue(defMatch[2]), default: defMatch[2].trim() };
      }
      
      // Plain parameter
      return { name: trimmed, type: null };
    }).filter(Boolean);
  }

  _inferTypeFromValue(value) {
    value = value.trim();
    if (value === 'None') return 'None';
    if (value === 'True' || value === 'False') return 'bool';
    if (/^['"]/.test(value)) return 'str';
    if (/^\d+$/.test(value)) return 'int';
    if (/^\d*\.\d+$/.test(value)) return 'float';
    if (/^\[/.test(value)) return 'list';
    if (/^\{/.test(value)) return 'dict';
    if (/^\(/.test(value)) return 'tuple';
    return null;
  }

  _analyzeCalls(code, importMap) {
    const localCalls = [];
    const externalCalls = [];
    const seen = new Set();
    
    const callRegex = /(?:self\.)?(\w+(?:\.\w+)?)\s*\(/g;
    const ignore = ['if', 'for', 'while', 'with', 'except', 'return', 'def', 'class', 
                    'print', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
                    'bool', 'type', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
                    'open', 'super', 'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr',
                    'any', 'all', 'min', 'max', 'sum', 'abs', 'round', 'iter', 'next', 'id', 'hash',
                    'repr', 'format', 'input', 'vars', 'dir', 'locals', 'globals', 'callable', 'eval', 'exec'];
    
    let match;
    while ((match = callRegex.exec(code)) !== null) {
      const name = match[1];
      const base = name.split('.')[0];
      
      if (ignore.includes(base) || seen.has(name)) continue;
      seen.add(name);
      
      const imp = importMap[base];
      if (imp) {
        externalCalls.push(name);
      } else if (!/^[A-Z]/.test(base) || base === 'self') {
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
    
    if (/print\s*\(|logging\.\w+/.test(code)) sideEffects.push('logging');
    if (/\.json\(|\.send\(|\.status\(|response\./.test(code)) sideEffects.push('http-response');
    if (/requests\.|aiohttp\.|httpx\.|urllib\./.test(code)) sideEffects.push('network');
    if (/open\s*\(|\.read\(|\.write\(|pathlib\.|shutil\./.test(code)) sideEffects.push('file-io');
    if (/time\.sleep|asyncio\.sleep|threading\./.test(code)) sideEffects.push('timing');
    if (/\.emit\(|\.connect\(|signal\./.test(code)) sideEffects.push('events');
    if (/subprocess\.|os\.system|os\.popen/.test(code)) sideEffects.push('subprocess');
    if (/sqlite3\.|psycopg|mysql|pymongo|redis\./.test(code)) sideEffects.push('database');
    
    const mutatesState = /self\.\w+\s*=/.test(code) || /\.append\(|\.extend\(|\.pop\(|\.remove\(|\.update\(|\.clear\(/.test(code);

    return { sideEffects, mutatesState };
  }

  _inferReturnPython(code) {
    // Check for type annotation in def line
    const annMatch = /->\s*([^:]+):/.exec(code.split('\n')[0]);
    if (annMatch) return annMatch[1].trim();
    
    // Check for async
    const isAsync = /^async\s+def/.test(code.trim());
    
    // Look for return statements
    const returnMatch = /return\s+(.+)$/m.exec(code);
    if (returnMatch) {
      const val = returnMatch[1].trim();
      let type = this._inferTypeFromValue(val);
      
      if (!type) {
        if (/^await\s/.test(val)) type = 'Awaitable';
        else if (/^\{/.test(val)) type = 'dict';
        else if (/^\[/.test(val)) type = 'list';
        else if (/^\(/.test(val)) type = 'tuple';
        else type = 'Any';
      }
      
      return isAsync ? `Coroutine[${type}]` : type;
    }
    
    // yield indicates generator
    if (/\byield\b/.test(code)) {
      return isAsync ? 'AsyncGenerator' : 'Generator';
    }
    
    // No return found
    return isAsync ? 'Coroutine[None]' : 'None';
  }

  _extractDocstring(code) {
    const lines = code.split('\n');
    let inDef = false;
    let docStart = -1;
    let docEnd = -1;
    let quote = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.match(/^(async\s+)?(def|class)\s+/)) {
        inDef = true;
        continue;
      }
      
      if (inDef && !quote) {
        if (line.startsWith('"""') || line.startsWith("'''")) {
          quote = line.slice(0, 3);
          docStart = i;
          
          // Single line docstring
          if (line.length > 3 && line.endsWith(quote)) {
            return line.slice(3, -3).trim();
          }
        } else if (line && !line.startsWith('#')) {
          break; // No docstring
        }
      }
      
      if (quote && i > docStart) {
        if (line.endsWith(quote) || line.includes(quote)) {
          docEnd = i;
          break;
        }
      }
    }
    
    if (docStart >= 0 && docEnd >= 0) {
      const docLines = lines.slice(docStart, docEnd + 1);
      let doc = docLines.join('\n');
      doc = doc.replace(/^['"`]{3}|['"`]{3}$/g, '').trim();
      return doc;
    }
    
    return null;
  }

  _cleanDoc(doc) {
    if (!doc) return null;
    // Remove common docstring formatting
    return doc
      .replace(/^\s*:param\s+\w+:.*$/gm, '')
      .replace(/^\s*:returns?:.*$/gm, '')
      .replace(/^\s*:raises?:.*$/gm, '')
      .replace(/^\s*:type\s+\w+:.*$/gm, '')
      .replace(/^\s*:rtype:.*$/gm, '')
      .replace(/Args:[\s\S]*?(?=Returns:|Raises:|Examples:|$)/gi, '')
      .replace(/Returns:[\s\S]*?(?=Raises:|Examples:|$)/gi, '')
      .replace(/Raises:[\s\S]*?(?=Examples:|$)/gi, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _classifyRole(name) {
    const n = name.toLowerCase();
    if (n.includes('controller') || n.includes('handler') || n.includes('view')) return 'controller';
    if (n.includes('service') || n.includes('manager')) return 'service';
    if (n.includes('util') || n.includes('helper')) return 'utility';
    if (n.includes('config') || n.includes('settings')) return 'config';
    if (n.includes('model') || n.includes('entity') || n.includes('schema')) return 'model';
    if (n.includes('route') || n.includes('router') || n.includes('endpoint')) return 'router';
    if (n.includes('test')) return 'test';
    if (n.includes('exception') || n.includes('error')) return 'exception';
    if (n.includes('mixin')) return 'mixin';
    if (n.includes('base') || n.includes('abstract')) return 'base';
    return 'module';
  }

  _classifyFuncRole(name, decorators = []) {
    // Check decorators first
    if (decorators.includes('property')) return 'property';
    if (decorators.includes('staticmethod')) return 'static';
    if (decorators.includes('classmethod')) return 'classmethod';
    if (decorators.some(d => d.includes('route') || d.includes('get') || d.includes('post'))) return 'endpoint';
    if (decorators.includes('pytest') || decorators.includes('fixture')) return 'test';
    
    const n = name.toLowerCase();
    if (n.startsWith('get_') || n.startsWith('fetch_') || n.startsWith('load_') || n.startsWith('read_')) return 'getter';
    if (n.startsWith('set_') || n.startsWith('update_') || n.startsWith('save_') || n.startsWith('write_')) return 'setter';
    if (n.startsWith('handle_') || n.startsWith('on_')) return 'handler';
    if (n.startsWith('create_') || n.startsWith('make_') || n.startsWith('build_')) return 'factory';
    if (n.startsWith('validate_') || n.startsWith('check_') || n.startsWith('is_') || n.startsWith('has_')) return 'validator';
    if (n.startsWith('parse_') || n.startsWith('format_') || n.startsWith('convert_') || n.startsWith('to_')) return 'transformer';
    if (n.includes('init') || n.includes('setup') || n.includes('configure')) return 'initializer';
    if (n.startsWith('test_')) return 'test';
    if (n.startsWith('_')) return 'private';
    return 'utility';
  }

  // Helpers
  _lineNum(content, index) {
    return content.slice(0, index).split('\n').length;
  }

  _blockEndPython(lines, start) {
    // Python uses indentation for blocks
    const startLine = lines[start];
    const baseIndent = this._getIndent(startLine);
    
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const currentIndent = this._getIndent(line);
      
      // If we find a line with same or less indentation that's not empty, block ends
      if (currentIndent <= baseIndent) {
        return i;
      }
    }
    
    return lines.length;
  }

  _methodEndPython(lines) {
    if (lines.length === 0) return 0;
    
    const firstLine = lines[0];
    const baseIndent = this._getIndent(firstLine);
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const currentIndent = this._getIndent(line);
      
      // Method ends when we see same or less indentation
      if (currentIndent <= baseIndent) {
        return i;
      }
    }
    
    return lines.length;
  }

  _getIndent(line) {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    
    // Convert tabs to spaces (assume 4 spaces per tab)
    const whitespace = match[1];
    let indent = 0;
    for (const char of whitespace) {
      if (char === '\t') indent += 4;
      else indent += 1;
    }
    return indent;
  }
}

module.exports = PythonParser3;
