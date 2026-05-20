import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAppContext } from '../context/AppContext';
import { SlotType } from '../types';
import { MONTH_NAMES } from '../constants';

interface TurneroFilterOptions {
  showGridHours: boolean;
  doctorFilter: number[];
  selectedRoles: string[];
  selectedCategories: string[];
}

export function useExportActions(filters: TurneroFilterOptions) {
  const {
    doctors, currentMonthData, variables, selectedMonth, selectedYear,
    daysInMonth, auditLogs, shiftRequests, activities, ruralAvailabilities,
  } = useAppContext();

  const { showGridHours, doctorFilter, selectedRoles, selectedCategories } = filters;

  const getFilteredTurneroData = () => {
    return doctors.filter(d =>
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) &&
      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
    ).map(med => {
      let medTotalMonth = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[med.id]?.[slot]?.[day] || 'X';
          medTotalMonth += variables[slot][sigla] || 0;
        });
      }
      return { med, medTotalMonth };
    });
  };

  const exportTurneroExcel = () => {
    const data = getFilteredTurneroData();
    const rows: any[] = [];

    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const rowData: any = {
          'MÉDICO': sIdx === 0 ? med.nombre : '',
          'JORNADA': slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche',
        };
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          rowData[d.toString()] = val !== 'X' ? (showGridHours ? (variables[slot][val] || 0) : val) : '';
        }
        if (sIdx === 0) rowData['TOTAL HORAS'] = medTotalMonth;
        rows.push(rowData);
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const totalColIdx = 2 + daysInMonth;
    const totalColLetter = XLSX.utils.encode_col(totalColIdx);

    data.forEach((_, idx) => {
      const rowNum = (idx * 3) + 2;
      for (let j = 0; j < 3; j++) {
        const r = rowNum + j;
        const cellRef = `${totalColLetter}${r}`;
        if (showGridHours) {
          const startCell = XLSX.utils.encode_cell({ r: r - 1, c: 2 });
          const endCell = XLSX.utils.encode_cell({ r: r - 1, c: 1 + daysInMonth });
          ws[cellRef] = { t: 'n', f: `SUM(${startCell}:${endCell})` };
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Turnero_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportTurneroPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont('helvetica', 'bold');
    doc.text(`Turnero Médico - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`, 14, 15);

    const data = getFilteredTurneroData();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const tableColumn = ['MÉDICO', 'JORNADA', ...daysArr, 'TOTAL'];
    const tableRows: any[] = [];

    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const row: any[] = [
          sIdx === 0 ? med.nombre : '',
          slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N',
        ];
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          row.push(val !== 'X' ? (showGridHours ? `${variables[slot][val] || 0}` : val) : '');
        }
        row.push(sIdx === 0 ? `${medTotalMonth}h` : '');
        tableRows.push(row);
      });
    });

    (doc as any).autoTable({
      head: [tableColumn], body: tableRows, startY: 20, theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    });

    doc.save(`Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const exportNovedadesExcel = () => {
    const filteredLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert('No hay novedades para este mes.');

    const rows = filteredLogs.map(l => ({
      'Fecha': new Date(l.timestamp).toLocaleString(),
      'Médico': l.doctorName, 'Día': l.day, 'Jornada': l.slot.toUpperCase(),
      'Anterior': l.oldSigla, 'Nuevo': l.newSigla, 'Autor': l.adminName,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Novedades');
    XLSX.writeFile(wb, `Reporte_Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportNovedadesPDF = () => {
    const filteredLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert('No hay novedades para este mes.');

    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, 595, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE MENSUAL DE NOVEDADES', 40, 38);
    doc.setFontSize(10);
    doc.text(`ESE ROLDANILLO - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);

    (doc as any).autoTable({
      startY: 80,
      head: [['FECHA', 'MÉDICO', 'DÍA', 'SLOT', 'ANT.', 'NUEV.', 'AUTOR']],
      body: filteredLogs.map(l => [new Date(l.timestamp).toLocaleDateString(), l.doctorName, l.day, l.slot.toUpperCase(), l.oldSigla, l.newSigla, l.adminName]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });
    doc.save(`Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const exportPICExcel = () => {
    const current = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (current.length === 0) return alert('No hay actividades para exportar.');

    const rows = current.map(a => ({
      'Día': a.day, 'Actividad': a.activityName, 'Lugar': a.place,
      'Modalidad': a.modality, 'Horas': a.hours, 'Responsable': a.responsible,
      'Dirigida a': a.targetGroup, 'Población': a.targetPopulation, 'Estado': a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PIC_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `PIC_Capacitaciones_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportPICPDF = () => {
    const current = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (current.length === 0) return alert('No hay actividades para exportar.');

    const doc = new jsPDF('l', 'pt', 'a4');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 842, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PIC - PROGRAMA INSTITUCIONAL DE CAPACITACIONES', 40, 38);
    doc.setFontSize(10);
    doc.text(`PLAN DE CAPACITACIÓN HDSAR - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);

    (doc as any).autoTable({
      startY: 80,
      head: [['DÍA', 'ACTIVIDAD', 'LUGAR', 'MODALIDAD', 'H', 'RESPONSABLE', 'DIRIGIDA A', 'POBLACIÓN']],
      body: current.sort((a, b) => a.day - b.day).map(a => [a.day, a.activityName, a.place, a.modality.toUpperCase(), a.hours, a.responsible, a.targetGroup, a.targetPopulation]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 150 }, 2: { cellWidth: 80 }, 3: { cellWidth: 70 }, 4: { cellWidth: 20 }, 5: { cellWidth: 100 }, 6: { cellWidth: 100 }, 7: { cellWidth: 100 } },
      margin: { top: 80 },
    });
    doc.save(`PIC_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const exportShiftRequests = () => {
    const filtered = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert('No hay solicitudes para exportar.');

    let content = `SOLICITUDES DE CAMBIO - ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n`;
    content += `Generado: ${new Date().toLocaleString()}\n\n`;
    filtered.forEach(r => {
      content += `[${r.status.toUpperCase()}] Dr. ${r.doctorName} - Día ${r.day} (${r.slot.toUpperCase()})\n`;
      content += `  Motivo: ${r.reason}\n  Fecha: ${new Date(r.timestamp).toLocaleString()}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Solicitudes_${MONTH_NAMES[selectedMonth]}_${selectedYear}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRuralExcel = () => {
    const filtered = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert('No hay registros de disponibilidad rural para exportar.');

    const rows = filtered.map(r => ({
      'Médico': r.doctorName,
      'Fecha Llamado': new Date(r.callDateTime).toLocaleString(),
      'Llegada Hospital': r.hospitalArrivalTime,
      'Actividad': r.activity,
      'Paciente': r.patientName,
      'ID Paciente': r.patientId,
      'Diagnóstico': r.diagnosis,
      'Lugar Aceptación': r.acceptancePlace,
      'Llamado por': r.calledBy,
      'Fin': new Date(r.terminationDateTime).toLocaleString(),
      'Horas': r.totalHours,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rural_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `Disponibilidad_Rural_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const downloadTemplateExcel = () => {
    const filename = `Plantilla_Turnos_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`;
    const header = ['ID_MEDICO', 'NOMBRE_MEDICO', 'JORNADA'];
    for (let i = 1; i <= 31; i++) header.push(`DIA_${i}`);

    const templateRows = doctors.filter(d => d.st === 'activo').flatMap(d =>
      (['m', 't', 'n'] as SlotType[]).map(slot => {
        const row: any = { ID_MEDICO: d.id, NOMBRE_MEDICO: d.nombre, JORNADA: slot };
        for (let i = 1; i <= 31; i++) row[`DIA_${i}`] = '';
        return row;
      })
    );

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Turnero');
    XLSX.writeFile(wb, filename);
  };

  return {
    getFilteredTurneroData,
    exportTurneroExcel,
    exportTurneroPDF,
    exportNovedadesExcel,
    exportNovedadesPDF,
    exportPICExcel,
    exportPICPDF,
    exportShiftRequests,
    exportRuralExcel,
    downloadTemplateExcel,
  };
}
