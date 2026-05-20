import { GoogleGenAI } from '@google/genai';
import { useAppContext } from '../context/AppContext';
import { AIEngineSettings, MonthlyData, AuditEntry, SlotType } from '../types';
import { MONTH_NAMES } from '../constants';

export function useAIActions() {
  const {
    session, doctors, variables, currentMonthData, setCurrentMonthData,
    selectedMonth, selectedYear, shiftRequests, activities, auditLogs, ruralAvailabilities,
    setIsGeneratingAI, setAiReport, notify,
  } = useAppContext();

  const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const generateAISchedulingProposal = async (settings: AIEngineSettings) => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const monthRequests = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const siglaStats = Object.entries(variables).map(([slot, map]) => `${slot.toUpperCase()}: [${Object.keys(map).join(', ')}]`).join(' | ');

      const prompt = `Actúa como un experto en logística hospitalaria y Programación Médica (Shift Scheduling).
      CONTEXTO: Generar la propuesta de turnos para ${MONTH_NAMES[selectedMonth]} ${selectedYear} (${daysCount} días).
      PERSONAL DISPONIBLE:
      ${activeDoctors.map(d => `- ID: ${d.id}, Nombre: ${d.nombre}, Rol: ${d.rol}, Categoría: ${d.cat}`).join('\n')}
      SIGLAS DISPONIBLES: ${siglaStats}
      SOLICITUDES / RESTRICCIONES:
      ${monthRequests.map(r => `- Dr. ${r.doctorName} (ID ${r.doctorId}) pidió ${r.slot.toUpperCase()} el día ${r.day}: ${r.reason}`).join('\n')}
      REGLAS INSTITUCIONALES (SHIFT ENGINE V3):
      1. Máximo noches consecutivas: ${settings.maxConsecutiveNights}
      2. Descanso mínimo entre turnos: ${settings.minRestHoursBetweenShifts}h
      3. Máximo turnos por mes: ${settings.maxShiftsPerMonth}
      4. Espaciado fines de semana: ${settings.weekendSpacingWeeks} semanas
      5. Fines de semana libres mínimos: ${settings.mandatoryFreeWeekends}
      6. Priorizar Rurales para Disponibilidad (D1/D2/D3): ${settings.priorityRuralD1 ? 'SÍ' : 'NO'}
      7. Bloquear Tripletes: ${settings.blockTriplets ? 'SÍ' : 'NO'}
      8. Descanso Post-Turno (PT): ${settings.enablePostShiftRest ? 'SÍ' : 'NO'}
      ${settings.customRules ? `OTRAS REGLAS:\n${settings.customRules}` : ''}
      TAREA: Genera una PROPUESTA DE PROGRAMACIÓN lógica y optimizada en Markdown profesional con tablas y secciones de "Razonamiento del Algoritmo".`;

      const ai = getAI();
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-preview-05-20', contents: prompt });
      setAiReport(response.text || 'No se pudo generar la propuesta.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al generar propuesta con el Engine V3. Verifica el API Key de Gemini.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAIStatsReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const totalPossibleSlots = activeDoctors.length * daysCount * 3;
      let usedSlots = 0, totalHours = 0;
      const areaStats: Record<string, number> = { 'Urgencias': 0, 'Hospitalización': 0, 'Cirugía': 0, 'Consulta Externa': 0, 'Triage': 0, 'Otros': 0 };

      activeDoctors.forEach(d => {
        ['m', 't', 'n'].forEach(slot => {
          for (let day = 1; day <= daysCount; day++) {
            const sigla = currentMonthData[d.id]?.[slot as SlotType]?.[day];
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              usedSlots++;
              totalHours += variables[slot as SlotType]?.[sigla] || 0;
              const s = sigla.toUpperCase();
              if (s.includes('CX')) areaStats['Cirugía']++;
              else if (s === 'EXT' || s.startsWith('CE')) areaStats['Consulta Externa']++;
              else if (s === 'TR' || d.rol === 'Triage') areaStats['Triage']++;
              else if (s.startsWith('12')) areaStats['Hospitalización']++;
              else if (['M','T','N','10','11','13','14','15','16'].some(x => s.startsWith(x))) areaStats['Urgencias']++;
              else areaStats['Otros']++;
            }
          }
        });
      });

      const monthActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
      const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
      const ruralReports = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);

      const prompt = `Actúa como un experto en analítica hospitalaria. Analiza los siguientes indicadores del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:
      ESTADÍSTICAS OPERATIVAS:
      - Capacidad Instalada: ${usedSlots} / ${totalPossibleSlots} (${((usedSlots / totalPossibleSlots) * 100).toFixed(1)}%)
      - Horas totales asistenciales: ${totalHours}h
      DISTRIBUCIÓN POR ÁREAS:
      ${Object.entries(areaStats).map(([k, v]) => `- ${k}: ${v} turnos`).join('\n')}
      CALIDAD Y CAPACITACIÓN (PIC):
      - Actividades Programadas: ${monthActivities.length}
      - Realizadas: ${monthActivities.filter(a => a.status === 'realizada').length}
      - Canceladas: ${monthActivities.filter(a => a.status === 'cancelada').length}
      INDICADORES DE USO:
      - Cambios/Novedades registrados: ${monthLogs.length}
      - Reportes de disponibilidad rural: ${ruralReports.length}
      - Médicos activos: ${activeDoctors.length}
      Genera un análisis estadístico gerencial estructurado. Usa solo negritas y viñetas en Markdown.`;

      const ai = getAI();
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-preview-05-20', contents: prompt });
      setAiReport(response.text || 'No se pudo generar el reporte.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al generar reporte IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAISuggestions = async (): Promise<MonthlyData | null> => {
    if (!session) return null;
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const doctorsList = activeDoctors.map((d, i) => ({ id: d.id, nombre: d.nombre, cat: d.cat, rol: d.rol, index: i + 1 }));

      const prompt = `Eres un experto en gestión de turnos hospitalarios. Genera una propuesta de turnos para ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
Médicos disponibles: ${JSON.stringify(doctorsList)}
REGLAS:
1. Médicos Rurales (Índices 1-5): ÚNICOS para 'D1', 'D2', 'D3'.
2. Índices 6-8: solo 'D2' o 'D3'. NUNCA 'D1'.
3. CTA/Contrato: fin de semana libre cada 15 días.
4. Planta: misma cantidad de noches entre sí.
5. Si turno Noche ('n'), el siguiente día mañana debe ser 'PT'.
SIGLAS: Mañana: M,10m,11m,12m,13m,14m,15m,16m,D1,PT | Tarde: T,10t,11t,12t,13t,14t,15t,16t,CX2,D2,PT | Noche: N,11-10n,13n,14n,16n,D3,PT
Responde ÚNICAMENTE con JSON (sin markdown):
{"doctorId":{"m":{"1":"SIGLA","2":"SIGLA"},"t":{},"n":{}}}
Donde los días son del 1 al ${daysCount}.`;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      return JSON.parse(response.text) as MonthlyData;
    } catch (error) {
      console.error('AI Error:', error);
      notify('Error al generar sugerencias con IA.', 'error');
      return null;
    }
  };

  const applyAISuggestions = async (suggestions: MonthlyData) => {
    const now = Date.now();
    const entries: AuditEntry[] = [];

    Object.entries(suggestions).forEach(([docIdStr, shifts]) => {
      const docId = parseInt(docIdStr);
      const doctor = doctors.find(d => d.id === docId);
      if (!doctor) return;

      ['m', 't', 'n'].forEach(slot => {
        Object.entries((shifts as any)[slot] || {}).forEach(([dayStr, sigla]) => {
          const day = parseInt(dayStr);
          const oldSigla = currentMonthData[docId]?.[slot as SlotType]?.[day] || '';
          if (oldSigla !== sigla) {
            entries.push({
              id: Math.floor(Math.random() * 1000000), timestamp: now,
              targetMonth: selectedMonth, targetYear: selectedYear,
              doctorId: docId, doctorName: doctor.nombre,
              day, slot: slot as SlotType, oldSigla, newSigla: sigla as string,
              adminName: session?.n || 'AI Suggestion',
            });
          }
        });
      });
    });

    setCurrentMonthData(prev => ({ ...prev, ...suggestions }));
    notify('Sugerencias aplicadas correctamente.', 'success');
    return entries;
  };

  return {
    generateAISchedulingProposal,
    generateAIStatsReport,
    generateAISuggestions,
    applyAISuggestions,
  };
}
