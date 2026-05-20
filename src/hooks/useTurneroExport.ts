import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { SlotType, MonthlyData, VarSlotConfig, Doctor } from '../types';
import { MONTH_NAMES } from '../constants';

interface ExportParams {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  daysInMonth: number;
  showGridHours: boolean;
  selectedRoles: string[];
  selectedCategories: string[];
  doctorFilter: number[];
}

export function useTurneroExport(params: ExportParams) {
  const {
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours, selectedRoles, selectedCategories, doctorFilter
  } = params;

  const getFilteredData = () => {
    return doctors.filter(d =>
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) &&
      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
    ).map(med => {
      let medTotalMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          medTotalMonth += variables[slot][sigla] || 0;
        });
      }
      return { med, medTotalMonth };
    });
  };

  const exportExcel = () => {
    const data = getFilteredData();
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

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont("helvetica", "bold");
    doc.text(`Turnero Médico - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`, 14, 15);
    const data = getFilteredData();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const tableColumn = ["MÉDICO", "JORNADA", ...daysArr, "TOTAL"];
    const tableRows: any[] = [];
    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const row: any[] = [
          sIdx === 0 ? med.nombre : '',
          slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N'
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
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    });
    doc.save(`Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  return { exportExcel, exportPDF, getFilteredData };
}
