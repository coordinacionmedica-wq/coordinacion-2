import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  FileDown, 
  FileSpreadsheet, 
  BrainCircuit, 
  Sparkles, 
  Save, 
  Info,
  CheckCircle,
  Database,
  Users as UsersIcon,
  Clock
} from 'lucide-react';
import { AIEngineSettings, SlotType, VarSlotConfig, Doctor } from '../types';
import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface AdminToolboxProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  variables: VarSlotConfig;
  doctors: Doctor[];
  onGenerateProposal: (settings: AIEngineSettings) => Promise<void>;
  isGenerating: boolean;
  selectedMonth: number;
  selectedYear: number;
}

export const AdminToolbox: React.FC<AdminToolboxProps> = ({ 
  onNotify, 
  variables, 
  doctors, 
  onGenerateProposal, 
  isGenerating,
  selectedMonth,
  selectedYear
}) => {
  const [aiSettings, setAiSettings] = useState<AIEngineSettings>({
    maxConsecutiveNights: 1,
    minRestHoursBetweenShifts: 12,
    maxShiftsPerMonth: 20,
    weekendSpacingWeeks: 2,
    priorityRuralD1: true,
    blockTriplets: true,
    enablePostShiftRest: true,
    mandatoryFreeWeekends: 1,
    customRules: ""
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'aiEngineV3'));
        if (snap.exists()) {
          setAiSettings(snap.data() as AIEngineSettings);
        }
      } catch (err) {
        console.error("Error loading AI settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'aiEngineV3'), aiSettings);
      onNotify("Reglas institucionales actualizadas correctamente", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/aiEngineV3');
      onNotify("Error al guardar reglas", 'error');
    }
  };

  const downloadTableTemplate = (type: 'shifts' | 'users' | 'siglas') => {
    let data: any[] = [];
    let filename = "";

    if (type === 'shifts') {
      filename = `plantilla_turnos_importados_${new Date().getMonth() + 1}_${new Date().getFullYear()}.xlsx`;
      const header = ["ID_MEDICO", "NOMBRE_MEDICO", "JORNADA"];
      for (let i = 1; i <= 31; i++) header.push(`DIA_${i}`);
      header.push("NOTAS");
      data = [header];
      
      // Pre-fill with active doctors for convenience
      doctors.filter(d => d.st === 'activo').sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(d => {
        data.push([d.id, d.nombre, 'm', ...Array(31).fill(''), ""]);
        data.push([d.id, d.nombre, 't', ...Array(31).fill(''), ""]);
        data.push([d.id, d.nombre, 'n', ...Array(31).fill(''), ""]);
      });

      // Add a hidden sheet for Instructions
      const instructions = [
        ["INSTRUCCIONES PARA IMPORTACIÓN MASIVA"],
        ["1. Use las siglas configuradas en el sistema (Ej: 7-13, 13-19, N, D1, PT)."],
        ["2. No modifique los IDs de los médicos."],
        ["3. Deje en blanco si el médico no tiene turno ese día."],
        ["4. Los turnos de noche deben marcarse con la sigla 'N' o la configurada para la jornada nocturna."]
      ];
      data.push([], ...instructions);
    } else if (type === 'users') {
      filename = "nomina_personal_medico_actualizado.xlsx";
      data = [
        ["ID", "Nombre", "Apellidos", "Cedula", "Registro_Medico", "Email", "Telefono", "Categoria", "Rol", "Estado", "Username", "Password"],
      ];
      
      // If there are existing doctors, export them so they can be edited
      if (doctors.length > 0) {
        doctors.forEach(d => {
          data.push([
            d.id, 
            d.nombre, 
            d.apellidos || "", 
            d.cedula || "", 
            d.registroMedico || "", 
            d.email || "", 
            d.telefono || "", 
            d.cat, 
            d.rol, 
            d.st, 
            d.username || "", 
            d.password || ""
          ]);
        });
      } else {
        // Example if empty
        data.push([1, "Juan", "Perez", "123456", "RM-789", "juan@example.com", "3001234567", "Planta", "Médico General", "activo", "jperez", "pass123"]);
      }
    } else if (type === 'siglas') {
      filename = "configuracion_siglas_sistema.xlsx";
      data = [
        ["Sigla", "Jornada_m_t_n", "Horas_Carga"],
      ];

      // Export current variables configuration
      Object.entries(variables).forEach(([slot, map]) => {
        Object.entries(map).forEach(([sigla, horas]) => {
          data.push([sigla, slot, horas]);
        });
      });

      if (data.length === 1) {
        // Examples if no variables defined yet
        data.push(["7-13", "m", 6]);
        data.push(["13-19", "t", 6]);
        data.push(["N", "n", 12]);
        data.push(["D1", "m", 24]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, filename);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'shifts' | 'users' | 'siglas') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (type === 'users') {
          onNotify(`Iniciando importación de ${data.length} usuarios...`, 'info');
          for (const row of data as any[]) {
            const doctorId = row.ID || row.Id || row.id;
            if (!doctorId) continue;

            const docData: Partial<Doctor> = {
              id: Number(doctorId),
              nombre: row.Nombre || row.nombre || "",
              apellidos: row.Apellidos || row.apellidos || "",
              cedula: String(row.Cedula || row.cedula || ""),
              registroMedico: String(row.Registro_Medico || row.registro_medico || ""),
              email: row.Email || row.email || "",
              telefono: row.Telefono || row.telefono || "",
              cat: (row.Categoria || row.categoria || "Planta") as any,
              rol: row.Rol || row.rol || "Médico General",
              st: (row.Estado || row.estado || "activo") as any,
              username: row.Username || row.username || "",
              password: String(row.Password || row.password || "123456")
            };
            await setDoc(doc(db, 'doctors', String(doctorId)), docData, { merge: true });
          }
          onNotify("Talento Humano actualizado correctamente", 'success');
        } else if (type === 'siglas') {
          onNotify("Actualizando configuración de siglas...", 'info');
          // This one is trickier as it updates the 'settings/variables' document
          const newVars: VarSlotConfig = { m: {}, t: {}, n: {} };
          for (const row of data as any[]) {
            const sigla = row.Sigla || row.sigla;
            const jornadaRaw = String(row.Jornada_m_t_n || row.jornada || row.Jornada || 'm').toLowerCase();
            const jornada = (jornadaRaw.includes('m') ? 'm' : jornadaRaw.includes('t') ? 't' : jornadaRaw.includes('n') ? 'n' : 'm') as SlotType;
            const horas = Number(row.Horas_Carga || row.horas || 6);
            if (sigla && newVars[jornada]) {
              newVars[jornada][sigla] = horas;
            }
          }
          await setDoc(doc(db, 'settings', 'variables'), newVars);
          onNotify("Configuración de siglas actualizada", 'success');
        } else if (type === 'shifts') {
          const monthKey = `${selectedYear}_${selectedMonth}`;
          onNotify(`Importando turnos para el mes ${selectedMonth + 1}/${selectedYear}...`, 'info');
          
          for (const row of data as any[]) {
            const doctorId = row.ID_MEDICO || row.id_medico || row.ID || row.Id || row.id;
            if (!doctorId) continue;

            const rawJ = String(row.JORNADA || row.jornada || row['JORNADA'] || row['Jornada'] || row['Slot'] || row['slot'] || "").trim().toLowerCase();
            let slot: SlotType = 'm';
            if (rawJ === 't' || rawJ === 'tarde' || rawJ.includes('tard')) slot = 't';
            else if (rawJ === 'n' || rawJ === 'noche' || rawJ.includes('noch')) slot = 'n';
            else if (rawJ === 'm' || rawJ === 'mañana' || rawJ.includes('mañ')) slot = 'm';
            else {
               if (rawJ.startsWith('t')) slot = 't';
               else if (rawJ.startsWith('n')) slot = 'n';
               else slot = 'm';
            }

            const shiftUpdate: any = {};
            // Iterate day columns
            for (let i = 1; i <= 31; i++) {
              const val = row[`DIA_${i}`] || row[i.toString()] || row[i] || row[`${i}`] || row[`dia_${i}`] || row[`dia ${i}`];
              if (val !== undefined && val !== null && val.toString().trim() !== '') {
                shiftUpdate[i.toString()] = val.toString().trim();
              }
            }

            if (Object.keys(shiftUpdate).length > 0) {
              await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), {
                [slot]: shiftUpdate
              }, { merge: true });
            }
          }
          onNotify("Turnos importados exitosamente", 'success');
        }
        
        // Refresh page to see changes
        setTimeout(() => window.location.reload(), 1500);

      } catch (err) {
        console.error("Error en importación:", err);
        onNotify("Error al procesar el archivo. Verifica el formato.", 'error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  if (isLoading) return <div className="p-4 text-center text-sm animate-pulse">Cargando...</div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* AI ENGINE V3 SETTINGS */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
             <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">IA Shift Engine V3</h3>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Configuración de Reglas Institucionales</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
           <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Máx. Noches Consecutivas
              </label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                value={aiSettings.maxConsecutiveNights}
                onChange={e => setAiSettings({...aiSettings, maxConsecutiveNights: Number(e.target.value)})}
              />
           </div>
           <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Descanso Mínimo (Horas)
              </label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                value={aiSettings.minRestHoursBetweenShifts}
                onChange={e => setAiSettings({...aiSettings, minRestHoursBetweenShifts: Number(e.target.value)})}
              />
           </div>
           <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Máx. Turnos por Mes
              </label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                value={aiSettings.maxShiftsPerMonth}
                onChange={e => setAiSettings({...aiSettings, maxShiftsPerMonth: Number(e.target.value)})}
              />
           </div>
           <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" /> Espaciado Fin de Semana (Semanas)
              </label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                value={aiSettings.weekendSpacingWeeks}
                onChange={e => setAiSettings({...aiSettings, weekendSpacingWeeks: Number(e.target.value)})}
              />
           </div>
           <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Fines de Semana Libres / Mes
              </label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm outline-none focus:border-emerald-500 transition-all"
                value={aiSettings.mandatoryFreeWeekends}
                onChange={e => setAiSettings({...aiSettings, mandatoryFreeWeekends: Number(e.target.value)})}
              />
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
           {[
             { key: 'priorityRuralD1', label: 'Priorizar Rurales para Disponibilidad (D1/D2/D3)', icon: Sparkles },
             { key: 'blockTriplets', label: 'Bloquear Tripletes (No más de 3 turnos seguidos)', icon: Info },
             { key: 'enablePostShiftRest', label: 'Habilitar Descanso Obligatorio Post-Turno (PT)', icon: Clock }
           ].map(rule => (
             <button 
               key={rule.key}
               onClick={() => setAiSettings({...aiSettings, [rule.key]: !aiSettings[rule.key as keyof AIEngineSettings]})}
               className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${aiSettings[rule.key as keyof AIEngineSettings] ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
             >
                <rule.icon className={`w-5 h-5 ${aiSettings[rule.key as keyof AIEngineSettings] ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span className="text-xs font-black uppercase tracking-tight">{rule.label}</span>
             </button>
           ))}
        </div>

        <div className="mb-4">
           <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-2 block">Reglas Personalizadas (Prompt Directo para IA)</label>
           <textarea 
             className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 transition-all min-h-[100px]"
             placeholder="Ej: El Dr. X no hace noches los jueves. Las vacaciones de la Dra. Y del 10 al 15..."
             value={aiSettings.customRules}
             onChange={e => setAiSettings({...aiSettings, customRules: e.target.value})}
           />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button 
            onClick={saveSettings}
            className="flex-1 bg-slate-800 text-white font-black py-2.5 rounded-xl hover:bg-slate-900 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" /> Guardar Reglas
          </button>
          
          <button 
            onClick={() => onGenerateProposal(aiSettings)}
            disabled={isGenerating}
            className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-2.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 animate-pulse" />
            )}
            Generar Propuesta (V3 Engine)
          </button>
        </div>
      </div>

      {/* IMPORT TEMPLATES */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
             <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Centro de Plantillas</h3>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Descarga de Estructuras para Importación Masiva</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('shifts')}
              className="group bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-500 transition-all text-left space-y-3 w-full"
            >
                <div className="w-9 h-9 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <FileDown className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Plantilla de Turnos</h4>
                <p className="text-xs text-slate-400 font-bold leading-relaxed uppercase">Estructura para importar la programación mensual completa.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl cursor-pointer hover:bg-blue-100 transition-all font-black text-xs uppercase tracking-widest border border-blue-200">
              <Database className="w-4 h-4" /> Importar Turnos
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'shifts')} />
            </label>
           </div>

           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('users')}
              className="group bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-500 transition-all text-left space-y-3 w-full"
            >
                <div className="w-9 h-9 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Carga Talento Humano</h4>
                <p className="text-xs text-slate-400 font-bold leading-relaxed uppercase">Actualización masiva de personal, roles y credenciales.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all font-black text-xs uppercase tracking-widest border border-emerald-200">
              <Database className="w-4 h-4" /> Importar Usuarios
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'users')} />
            </label>
           </div>

           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('siglas')}
              className="group bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-500 transition-all text-left space-y-3 w-full"
            >
                <div className="w-9 h-9 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Catálogo de Siglas</h4>
                <p className="text-xs text-slate-400 font-bold leading-relaxed uppercase">Configurar códigos horarios y su respectiva carga horaria.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-2xl cursor-pointer hover:bg-amber-100 transition-all font-black text-xs uppercase tracking-widest border border-amber-200">
              <Database className="w-4 h-4" /> Importar Siglas
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'siglas')} />
            </label>
           </div>
        </div>
      </div>
    </div>
  );
};
