const fs = require('fs');
const path = require('path');

const files = [
  'src/components/NovedadesView.tsx',
  'src/components/AdminView.tsx',
  'src/components/CodigoRojoModal.tsx',
  'src/components/CodigoAzulModal.tsx',
  'src/components/SolicitudesView.tsx',
  'src/components/PICView.tsx',
  'src/components/RuralView.tsx',
  'src/components/AyudaView.tsx',
  'src/components/ActivitiesModal.tsx',
  'src/components/AdminToolbox.tsx',
  'src/components/ProductivityStatsView.tsx',
  'src/components/EditDoctorModal.tsx',
  'src/components/HomeView.tsx',
  'src/components/LoginPage.tsx',
  'src/components/BootScreen.tsx',
  'src/components/turnero/ShiftGridTable.tsx',
  'src/components/turnero/TurneroFilterPanel.tsx',
  'src/components/turnero/TurneroAIPanel.tsx',
  'src/components/TurneroView.tsx',
  'src/components/ResetPasswordPage.tsx',
];

let total = 0;
files.forEach(f => {
  const full = path.join(__dirname, f);
  if (!fs.existsSync(full)) { console.log('SKIP (not found): ' + f); return; }
  let c = fs.readFileSync(full, 'utf8');
  const before = c;
  c = c.replace(/text-\[9px\]/g, 'text-xs');
  c = c.replace(/text-\[10px\]/g, 'text-xs');
  c = c.replace(/text-\[11px\]/g, 'text-sm');
  if (c !== before) {
    fs.writeFileSync(full, c);
    total++;
    console.log('Updated: ' + f);
  }
});
console.log('\nDone. Files changed: ' + total);
