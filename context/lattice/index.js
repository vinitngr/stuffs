const path = require('path');
const fs = require('fs');

const parserRegistry = {
  v1: {
    '.js': './parsers/javascript',
    '.ts': './parsers/javascript',
    '.jsx': './parsers/javascript',
    '.tsx': './parsers/javascript',
    '.py': './parsers/python',
    '.go': './parsers/golang',
  }
};

class Lattice {
  constructor(options = {}) {
    this.version = options.version || 'v1';
    this.parsers = new Map();
    this._loadParsers();
  }

  _loadParsers() {
    const registry = parserRegistry[this.version] || parserRegistry.v1;
    for (const [ext, parserPath] of Object.entries(registry)) {
      if (!this.parsers.has(parserPath)) {
        const Parser = require(parserPath);
        this.parsers.set(parserPath, new Parser());
      }
    }
  }

  /**
   * Get the appropriate parser for a file extension
   * @param {string} ext - File extension (e.g., '.js')
   * @returns {Object|null} Parser instance or null
   */
  getParser(ext) {
    const registry = parserRegistry[this.version] || parserRegistry.v2;
    const parserPath = registry[ext];
    if (!parserPath) return null;
    return this.parsers.get(parserPath);
  }

  /**
   * Parse a single file and extract context
   * @param {string} filePath - Absolute path to the file
   * @returns {Object} Parsed context object
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath);
    const parser = this.getParser(ext);
    
    if (!parser) {
      return { error: `No parser available for ${ext}` };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    return {
      [fileName]: await parser.parse(content, filePath)
    };
  }

  /**
   * Parse multiple files
   * @param {string[]} filePaths - Array of file paths
   * @returns {Object} Combined parsed context
   */
  async parseFiles(filePaths) {
    const results = {};
    
    for (const filePath of filePaths) {
      const parsed = await this.parseFile(filePath);
      Object.assign(results, parsed);
    }
    
    return results;
  }

  /**
   * Get list of supported extensions
   * @returns {string[]}
   */
  getSupportedExtensions() {
    return Object.keys(parserRegistry);
  }
}

module.exports = Lattice;

if (require.main === module) {
  const lattice = new Lattice();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node index.js <file1> [file2] ...');
    console.log('Supported extensions:', lattice.getSupportedExtensions().join(', '));
    process.exit(0);
  }

  lattice.parseFiles(args.map(f => path.resolve(f)))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => console.error('Error:', err.message));
}
