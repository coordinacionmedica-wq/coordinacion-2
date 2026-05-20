const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

console.log('Total lines before:', lines.length);

// Find the dead code block boundaries
let deadStartLine = -1;
let deadEndLine = -1;
let stateStartLine = -1;
let stateEndLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Dead code removed - turnos tab now rendered by TurneroView')) {
    deadStartLine = i;
  }
  if (deadStartLine !== -1 && deadEndLine === -1 && i > deadStartLine) {
    // Look for the closing `)}` followed by the pic tab
    if (lines[i].trim() === ')}' && i + 1 < lines.length && lines[i+1].trim() === '' && i + 2 < lines.length && lines[i+2].includes("activeTab === 'pic'")) {
      deadEndLine = i; // inclusive
    }
  }
  if (lines[i].includes('Turnero local filter & display state')) {
    stateStartLine = i;
  }
  if (stateStartLine !== -1 && stateEndLine === -1 && lines[i].includes("const [editingValue, setEditingValue] = useState('')")) {
    stateEndLine = i;
  }
}

console.log('Dead block:', deadStartLine + 1, '-', deadEndLine + 1);
console.log('State block:', stateStartLine + 1, '-', stateEndLine + 1);

if (deadStartLine === -1 || deadEndLine === -1) {
  console.error('Could not find dead code block');
  process.exit(1);
}

// Remove dead block (keep the blank line before pic)
let newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (i >= deadStartLine && i <= deadEndLine + 1) continue; // +1 for the blank line after )}
  if (stateStartLine !== -1 && stateEndLine !== -1 && i >= stateStartLine && i <= stateEndLine) continue;
  newLines.push(lines[i]);
}

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Total lines after:', newLines.length);
console.log('Done!');
