const parser = require('@babel/parser');

function findTopRelevantLineRanges(code, query) {
    const lines = code.split('\n');
    const totalLines = lines.length;
    
    const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 0);
    
    if (queryTerms.length === 0 || !code) {
        return [
            { start: 1, end: Math.min(5, totalLines), score: 0.1 },
            { start: Math.max(1, totalLines - 5), end: totalLines, score: 0.1 },
            { start: 1, end: 3, score: 0.1 },
            { start: 3, end: 6, score: 0.1 },
            { start: 6, end: 9, score: 0.1 }
        ];
    }
    
    const lineScores = [];
    
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const lineText = lines[i];
        const lowerText = lineText.toLowerCase();
        
        let score = 0;
        
        queryTerms.forEach(term => {
            if (term.length < 2) return;
            
            let pos = lowerText.indexOf(term);
            while (pos !== -1) {
                const before = pos === 0 ? ' ' : lowerText[pos - 1];
                const after = pos + term.length >= lowerText.length ? ' ' : lowerText[pos + term.length];
                
                if (!/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after)) {
                    score += 2;
                } else {
                    score += 1;
                }
                
                pos = lowerText.indexOf(term, pos + 1);
            }
        });
        
        if (score > 0) {
            lineScores.push({
                line: lineNum,
                score: score,
                text: lineText
            });
        }
    }
    
    if (lineScores.length === 0) {
        return [
            { start: 1, end: Math.min(5, totalLines), score: 0.1 },
            { start: Math.max(1, totalLines - 5), end: totalLines, score: 0.1 },
            { start: 1, end: 3, score: 0.1 },
            { start: 3, end: 6, score: 0.1 },
            { start: 6, end: 9, score: 0.1 }
        ];
    }
    
    lineScores.sort((a, b) => b.score - a.score);
    
    const windows = [];
    const usedLines = new Set();
    
    for (let i = 0; i < Math.min(10, lineScores.length); i++) {
        const topLine = lineScores[i];
        
        if (usedLines.has(topLine.line)) continue;
        
        const windowSize = 7;
        const halfWindow = Math.floor(windowSize / 2);
        
        let start = Math.max(1, topLine.line - halfWindow);
        let end = Math.min(totalLines, topLine.line + halfWindow);
        
        let windowScore = topLine.score * 10;
        
        for (let l = start; l <= end; l++) {
            usedLines.add(l);
            
            if (l !== topLine.line) {
                const otherScore = lineScores.find(s => s.line === l);
                if (otherScore) {
                    const distance = Math.abs(l - topLine.line);
                    const proximity = 1 / (1 + distance);
                    windowScore += otherScore.score * proximity * 5;
                }
            }
        }
        
        windows.push({
            start: start,
            end: end,
            score: windowScore,
            center: topLine.line
        });
    }
    
    windows.sort((a, b) => b.score - a.score);
    
    const results = [];
    const usedRanges = new Set();
    
    for (const win of windows) {
        const rangeKey = `${win.start}-${win.end}`;
        if (usedRanges.has(rangeKey)) continue;
        
        results.push(win);
        usedRanges.add(rangeKey);
        
        if (results.length >= 5) break;
    }
    
    while (results.length < 5) {
        const idx = results.length;
        const start = Math.max(1, idx * 10 + 1);
        const end = Math.min(totalLines, start + 9);
        results.push({
            start: start,
            end: end,
            score: 0.1
        });
    }
    
    return results.slice(0, 5).map(r => ({
        start: r.start,
        end: r.end,
        score: Math.max(0.1, Math.min(100, r.score))
    }));
}

module.exports = findTopRelevantLineRanges;