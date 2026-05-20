const fs = require('fs');

// Read App.tsx
const appPath = 'src/App.tsx';
const appContent = fs.readFileSync(appPath, 'utf8');

// Find the turnos block (now wrapped in false &&)
const startMarker = "{activeTab === 'turnos' && false && (";
const endMarker = "{activeTab === 'pic' && (";

const startIdx = appContent.indexOf(startMarker);
const endIdx = appContent.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers', startIdx, endIdx);
  process.exit(1);
}

// Extract the JSX block (between startMarker and endMarker, but skip the wrapper)
const block = appContent.substring(startIdx + startMarker.length, endIdx);

// Remove the leading/trailing wrapper parts
const lines = block.split('\n');
// First line after startMarker should be blank or have the <motion.div
// Remove first line if it's blank (which it is)
let jsxLines = lines.slice(1);
// Remove last line if it's blank before the `)}`
if (jsxLines[jsxLines.length - 1].trim() === '') jsxLines.pop();
if (jsxLines[jsxLines.length - 1].trim() === ')}') jsxLines.pop();

const jsx = jsxLines.join('\n');

// Read TurneroView.tsx
const tvPath = 'src/components/TurneroView.tsx';
let tvContent = fs.readFileSync(tvPath, 'utf8');

// Replace the placeholder
const placeholder = '  // JSX_PLACEHOLDER\n  return null;\n}';
const replacement = `  // ── JSX ──────────────────────────────────────────────────\n  const setShowCallModal = onOpenCallModal;\n  const downloadTemplateExcel = onDownloadTemplate;\n  const handleImportExcel = onImportExcel;\n\n  return (\n${jsx}\n  );\n}`;

tvContent = tvContent.replace(placeholder, replacement);

fs.writeFileSync(tvPath, tvContent);
console.log('TurneroView.tsx updated successfully');
