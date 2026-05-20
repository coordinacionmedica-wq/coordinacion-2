const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the dead code block
const deadStart = '          {/* Dead code removed - turnos tab now rendered by TurneroView */}\n          {false && (\n            <motion.div \n              key="turnos-dead"';
const deadEnd = '          )}\n\n          {activeTab === \'pic\' && (';

const startIdx = content.indexOf(deadStart);
const endIdx = content.indexOf(deadEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Dead block markers not found', startIdx, endIdx);
  process.exit(1);
}

// Replace: remove everything from deadStart to just before {activeTab === 'pic'
const replacement = '\n          {activeTab === \'pic\' && (';
content = content.substring(0, startIdx) + replacement + content.substring(endIdx + deadEnd.length);

// Remove unused turnero local state from AppContent
const stateBlock = `  // ── Turnero local filter & display state ─────────────────
  const [doctorFilter, setDoctorFilter] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showGridHours, setShowGridHours] = useState(false);
  const [editingCell, setEditingCell] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);
  const [editingValue, setEditingValue] = useState('');`;

const stateIdx = content.indexOf(stateBlock);
if (stateIdx !== -1) {
  content = content.substring(0, stateIdx) + content.substring(stateIdx + stateBlock.length);
  console.log('Removed unused turnero state declarations');
} else {
  console.log('State block not found (may already be removed)');
}

fs.writeFileSync(filePath, content);
console.log('Done! Dead code removed from App.tsx');
console.log('New file length:', content.split('\n').length, 'lines');
