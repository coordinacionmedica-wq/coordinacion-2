const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

console.log('Lines before:', lines.length);

// 1. Remove the setShift wrapper (lines around 160-163 that reference setEditingCell)
let setShiftStart = -1;
let setShiftEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const setShift = async (doctorId: number, day: number, slot: SlotType, rawSigla: string)')) {
    setShiftStart = i;
  }
  if (setShiftStart !== -1 && setShiftEnd === -1 && lines[i].trim() === '};') {
    setShiftEnd = i;
    break;
  }
}
console.log('setShift wrapper:', setShiftStart + 1, '-', setShiftEnd + 1);

// 2. Find getFilteredTurneroData + exportTurneroExcel + exportTurneroPDF block
let exportStart = -1;
let exportEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const getFilteredTurneroData = ()')) {
    exportStart = i;
  }
  if (exportStart !== -1 && exportEnd === -1 && lines[i].includes("doc.save(`Turnero_")) {
    // Find the closing };
    for (let j = i; j < lines.length; j++) {
      if (lines[j].trim() === '};') {
        exportEnd = j;
        break;
      }
    }
    break;
  }
}
console.log('Export functions:', exportStart + 1, '-', exportEnd + 1);

// 3. Find roles + filteredRolesList block
let rolesStart = -1;
let rolesEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const roles = [") && lines[i+1] && lines[i+1].includes("'Médico Rural'")) {
    rolesStart = i;
  }
  if (rolesStart !== -1 && rolesEnd === -1 && lines[i].includes('const filteredRolesList =')) {
    rolesEnd = i;
    break;
  }
}
console.log('Roles block:', rolesStart + 1, '-', rolesEnd + 1);

// Build exclusion ranges
const excludeRanges = [];
if (setShiftStart !== -1 && setShiftEnd !== -1) excludeRanges.push([setShiftStart, setShiftEnd]);
if (exportStart !== -1 && exportEnd !== -1) excludeRanges.push([exportStart, exportEnd]);
if (rolesStart !== -1 && rolesEnd !== -1) excludeRanges.push([rolesStart, rolesEnd]);

function isExcluded(lineIdx) {
  for (const [s, e] of excludeRanges) {
    if (lineIdx >= s && lineIdx <= e) return true;
  }
  return false;
}

const newLines = lines.filter((_, i) => !isExcluded(i));
fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Lines after:', newLines.length);
console.log('Done!');


