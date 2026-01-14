
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle, PageBreak } from 'docx';
import saveAs from 'file-saver';
import { Training, Response, QuestionType } from '../types';
import { getResponses } from './storageService';

// Helper untuk format tanggal Indonesia
const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper Logic for Labeling (Shared Logic)
const getScoreLabel = (val: number, type: QuestionType) => {
    if (type === 'text') return '';
    if (type === 'star') {
        if (val >= 4.2) return 'Sangat Baik';
        if (val >= 3.4) return 'Baik';
        if (val >= 2.6) return 'Cukup';
        if (val >= 1.8) return 'Sedang';
        return 'Kurang';
    } else {
        // Slider Scale: 45-100 with breakpoints 55, 75, 85
        if (val >= 86) return 'Sangat Baik';
        if (val >= 76) return 'Baik';
        if (val >= 56) return 'Sedang';
        return 'Kurang';
    }
};

interface SessionExportData {
    name: string; // Added name to session data for flat list
    subject: string;
    sessionDate: string;
    order: number; // For sorting
    responses: Response[];
    averages: Record<string, string>; // Formatted "80 (Baik)"
    comments: Record<string, string[]>;
    overall: string;
    overallVal: number;
}

// Utility untuk memproses data mentah menjadi statistik untuk ekspor
const processDataForExport = (training: Training, responses: Response[]) => {
  const result: any = {
    // Structure: { "Nama Fasilitator": [SessionData1, SessionData2] }
    facilitators: {} as Record<string, SessionExportData[]>,
    process: {
      responses: [],
      averages: {},
      rawAverages: {}, 
      comments: {},
      overall: '', 
      overallVal: 0
    }
  };

  // 1. Group Facilitators by Name AND Subject
  responses.filter(r => r.type === 'facilitator').forEach(r => {
    const name = r.targetName || 'Unknown';
    const subject = r.targetSubject || 'Umum';

    if (!result.facilitators[name]) {
        result.facilitators[name] = [];
    }

    // Check if this subject session already exists in the array
    let session = result.facilitators[name].find((s: SessionExportData) => s.subject === subject);
    
    if (!session) {
        // Find metadata from training data (match name & subject for date)
        const facData = training.facilitators.find(f => f.name === name && f.subject === subject);
        
        session = {
            name: name,
            subject: subject,
            sessionDate: facData ? facData.sessionDate : '',
            order: facData ? (facData.order || 0) : 0,
            responses: [],
            averages: {},
            comments: {},
            overall: '',
            overallVal: 0
        };
        result.facilitators[name].push(session);
    }

    session.responses.push(r);
  });

  // 2. Calculate averages for each facilitator SESSION
  Object.keys(result.facilitators).forEach(name => {
      const sessions = result.facilitators[name] as SessionExportData[];
      
      sessions.forEach(session => {
          let totalFacScore = 0;
          let totalFacCount = 0;
          let dominantType: QuestionType = 'slider';

          training.facilitatorQuestions.forEach(q => {
            if (q.type === 'text') {
                session.comments[q.id] = session.responses.map((r: any) => r.answers[q.id]).filter((a: any) => a && a.trim() !== '');
            } else {
                dominantType = q.type;
                const scores = session.responses.map((r: any) => r.answers[q.id]).filter((v: any) => typeof v === 'number');
                const avg = scores.length ? scores.reduce((a: any, b: any) => a + b, 0) / scores.length : 0;
                
                totalFacScore += avg;
                totalFacCount++;

                const label = getScoreLabel(avg, q.type);
                session.averages[q.id] = `${avg.toFixed(2)} (${label})`;
            }
          });

          if (totalFacCount > 0) {
            const overallAvg = totalFacScore / totalFacCount;
            session.overallVal = overallAvg;
            session.overall = `${overallAvg.toFixed(2)} (${getScoreLabel(overallAvg, dominantType)})`;
        } else {
            session.overall = '0.00 (Kurang)';
            session.overallVal = 0;
        }
      });
  });

  // 3. Process Penyelenggaraan (Tetap Flat)
  const procResponses = responses.filter(r => r.type === 'process');
  result.process.responses = procResponses;
  let totalProcScore = 0;
  let totalProcCount = 0;
  let dominantProcType: QuestionType = 'slider';

  training.processQuestions.forEach(q => {
    if (q.type === 'text') {
      result.process.comments[q.id] = procResponses.map((r: any) => r.answers[q.id]).filter((a: any) => a && a.trim() !== '');
    } else {
      dominantProcType = q.type;
      const scores = procResponses.map((r: any) => r.answers[q.id]).filter((v: any) => typeof v === 'number');
      const avg = scores.length ? scores.reduce((a: any, b: any) => a + b, 0) / scores.length : 0;
      result.process.rawAverages[q.id] = avg;
      
      totalProcScore += avg;
      totalProcCount++;

      const label = getScoreLabel(avg, q.type);
      result.process.averages[q.id] = `${avg.toFixed(2)} (${label})`;
    }
  });

  // Calculate Overall for Process
  if (totalProcCount > 0) {
      const overallAvg = totalProcScore / totalProcCount;
      result.process.overallVal = overallAvg;
      result.process.overall = `${overallAvg.toFixed(2)} (${getScoreLabel(overallAvg, dominantProcType)})`;
  } else {
      result.process.overall = '0.00 (Kurang)';
  }

  return result;
};

// Helper: Get ALL sessions in a flat list sorted by DATE (for Section A)
const getFlatChronologicalSessions = (dataFacilitators: Record<string, SessionExportData[]>) => {
    let allSessions: SessionExportData[] = [];
    Object.values(dataFacilitators).forEach(sessions => {
        allSessions = [...allSessions, ...sessions];
    });

    return allSessions.sort((a, b) => {
        if (a.sessionDate < b.sessionDate) return -1;
        if (a.sessionDate > b.sessionDate) return 1;
        return a.order - b.order;
    });
};

// Helper: Get Sorted Facilitator Names (for Section B grouping), but ensure inner sessions are date sorted
const getSortedFacilitatorNamesForRecap = (dataFacilitators: Record<string, SessionExportData[]>, training: Training) => {
    // 1. Sort Names first
    const names = Object.keys(dataFacilitators).sort((a, b) => {
        const facA = training.facilitators.find(f => f.name === a);
        const facB = training.facilitators.find(f => f.name === b);
        const orderA = facA?.order || 0;
        const orderB = facB?.order || 0;
        return orderA - orderB;
    });

    // 2. Sort Sessions inside each Name by Date
    names.forEach(name => {
        dataFacilitators[name].sort((a, b) => {
            if (a.sessionDate < b.sessionDate) return -1;
            if (a.sessionDate > b.sessionDate) return 1;
            return 0;
        });
    });

    return names;
};

export const exportToPDF = async (training: Training) => {
  const responses = await getResponses(training.id);
  const data = processDataForExport(training, responses);
  const doc = new jsPDF();
  const timestamp = formatDateID(new Date().toISOString());

  doc.setFontSize(16);
  doc.text('Laporan Rekapitulasi Evaluasi Pelatihan', 14, 20);
  doc.setFontSize(10);
  
  // Wrap Title if too long
  const titleLines = doc.splitTextToSize(`Judul: ${training.title}`, 180);
  doc.text(titleLines, 14, 28);
  
  let y = 28 + (titleLines.length * 5); 
  
  doc.text(`Periode: ${formatDateID(training.startDate)} s/d ${formatDateID(training.endDate)}`, 14, y);
  y += 5;
  doc.text(`Dicetak pada: ${timestamp}`, 14, y);
  y += 10;

  // --- BAGIAN A: DETAIL FASILITATOR (FLAT LIST, CHRONOLOGICAL) ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('A. Evaluasi Detail Fasilitator', 14, y);
  y += 6;

  const flatSessions = getFlatChronologicalSessions(data.facilitators);

  flatSessions.forEach((session) => {
    // Page break check (Name Header)
    if (y > 240) { doc.addPage(); y = 20; }
    
    // Header Fasilitator Name
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 230, 250); // Light Purple
    doc.rect(14, y - 5, 182, 7, 'F');
    doc.text(`Nama Fasilitator: ${session.name}`, 16, y);
    y += 6;

    // Session Info
    doc.setFontSize(10);
    doc.setFont("helvetica", "bolditalic");
    const dateStr = session.sessionDate ? ` (${formatDateID(session.sessionDate)})` : '';
    // Wrap Subject
    const subjectLines = doc.splitTextToSize(`Materi: ${session.subject}${dateStr}`, 180);
    doc.text(subjectLines, 14, y);
    y += (subjectLines.length * 4); // Adjust spacing based on wrapped text

    // 1. Tabel Nilai
    const scoreRows = training.facilitatorQuestions
    .filter(q => q.type !== 'text')
    .map(q => [q.label, session.averages[q.id] || '0.00 (Kurang)']);

    scoreRows.push(['Rata-rata Keseluruhan', session.overall]);

    autoTable(doc, {
        startY: y,
        head: [['Variabel Penilaian', 'Rata-rata & Predikat']],
        body: scoreRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { fontStyle: 'bold' } },
        didParseCell: function (data) {
            if (data.row.index === scoreRows.length - 1 && data.section === 'body') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 240, 255]; 
            }
        },
        margin: { left: 14, right: 14 }
    });
    
    y = (doc as any).lastAutoTable.finalY + 5;

    // 2. Daftar Komentar
    const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = session.comments[q.id];
        if (comments && comments.length > 0) {
            if (y > 260) { doc.addPage(); y = 20; }
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(`Komentar - ${q.label}:`, 14, y);
            y += 2;

            const commentRows = comments.map((c: string) => [`• ${c}`]);
            autoTable(doc, {
                startY: y,
                body: commentRows,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1, overflow: 'linebreak' },
                margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 3;
        }
    });
    y += 4; // Spasi antar materi/orang
  });

  // --- BAGIAN B: REKAPITULASI (Summary Section B) ---
  // Group by Name, but ensure dates inside are sorted
  doc.addPage();
  y = 20;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('B. Rekapitulasi Nilai Keseluruhan', 14, y);
  y += 5;

  const summaryRows: any[] = [];
  let no = 1;
  let grandTotal = 0;
  let grandCount = 0;

  // Use Sorted Names here as well (Grouped by Name)
  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);

  sortedNames.forEach((name) => {
      data.facilitators[name].forEach((session: SessionExportData) => {
        summaryRows.push([
            no++, 
            name, 
            session.subject || '-', 
            formatDateID(session.sessionDate), 
            session.overall
        ]);
        grandTotal += session.overallVal;
        grandCount++;
      });
  });

  // Hitung Rata-rata Total
  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  // Tambahkan baris total
  summaryRows.push(['', '', '', 'RATA-RATA TOTAL', grandDisplay]);

  autoTable(doc, {
      startY: y,
      head: [['No', 'Nama Fasilitator', 'Materi', 'Tanggal', 'Nilai Akhir']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { fontStyle: 'bold', halign: 'center' } },
      margin: { left: 14, right: 14 },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.index === summaryRows.length - 1) {
             data.cell.styles.fontStyle = 'bold';
             data.cell.styles.fillColor = [229, 231, 235]; 
        }
      }
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // --- BAGIAN C: PENYELENGGARAAN ---
  doc.addPage();
  y = 20;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('C. Evaluasi Penyelenggaraan', 14, y);
  y += 6;

  if (training.processOrganizer && training.processOrganizer.name) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Penanggung Jawab: ${training.processOrganizer.name}`, 14, y);
    y += 6;
  }

  const procRows = training.processQuestions
    .filter(q => q.type !== 'text')
    .map(q => [q.label, data.process.averages[q.id] || '0.00 (Kurang)']);

  procRows.push(['Rata-rata Keseluruhan', data.process.overall]);

  autoTable(doc, {
    startY: y,
    head: [['Variabel Penilaian', 'Rata-rata & Predikat']],
    body: procRows,
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11] },
    columnStyles: { 0: { cellWidth: 120 }, 1: { fontStyle: 'bold' } },
    didParseCell: function (data) {
        if (data.row.index === procRows.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 248, 220]; 
        }
    },
    margin: { left: 14, right: 14 }
  });
  
  y = (doc as any).lastAutoTable.finalY + 5;

  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  procTextQs.forEach(q => {
      const comments = data.process.comments[q.id];
      if (comments && comments.length > 0) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`Komentar - ${q.label}:`, 14, y);
          y += 2;

          const commentRows = comments.map((c: string) => [`• ${c}`]);
          autoTable(doc, {
              startY: y,
              body: commentRows,
              theme: 'plain',
              styles: { fontSize: 9, cellPadding: 1 },
              margin: { left: 14, right: 14 }
          });
          y = (doc as any).lastAutoTable.finalY + 3;
      }
  });

  doc.save(`Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.pdf`);
};

export const exportToExcel = async (training: Training) => {
  const responses = await getResponses(training.id);
  const data = processDataForExport(training, responses);
  const wb = XLSX.utils.book_new();

  const infoData = [
      ['Judul Pelatihan', training.title],
      ['Periode', `${formatDateID(training.startDate)} s/d ${formatDateID(training.endDate)}`],
      ['Dicetak', formatDateID(new Date().toISOString())],
      []
  ];

  // --- SHEET 1: DETAIL FASILITATOR (Section A) - FLAT LIST CHRONOLOGICAL ---
  const detailRows: any[] = [...infoData, ['A. DETAIL EVALUASI FASILITATOR'], []];
  
  const flatSessions = getFlatChronologicalSessions(data.facilitators);

  flatSessions.forEach((session) => {
      detailRows.push([`NAMA FASILITATOR: ${session.name}`]);
      detailRows.push([`Materi: ${session.subject}`, `Tanggal: ${formatDateID(session.sessionDate)}`]);
      
      detailRows.push(['Variabel', 'Nilai']);
      training.facilitatorQuestions.filter(q => q.type !== 'text').forEach(q => {
          detailRows.push([q.label, session.averages[q.id]]);
      });
      detailRows.push(['Rata-rata Keseluruhan', session.overall]);

      const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
      if (textQs.length > 0) {
          detailRows.push(['Komentar / Saran Responden:']);
          textQs.forEach(q => {
              const cmts = session.comments[q.id];
              if (cmts && cmts.length > 0) {
                 detailRows.push([`[${q.label}]`]);
                 cmts.forEach((c: string) => detailRows.push([` - ${c}`]));
              }
          });
      }
      detailRows.push([]); // Spacer
  });

  const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, detailWs, 'A. Detail Fasilitator');

  // --- SHEET 2: REKAPITULASI (Section B) - GROUPED NAME, SORTED DATE ---
  const summaryHeader = ['No', 'Nama Fasilitator', 'Materi', 'Tanggal', 'Nilai Akhir'];
  const summaryRows: any[] = [];
  let no = 1;
  let grandTotal = 0;
  let grandCount = 0;

  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);

  sortedNames.forEach((name) => {
    data.facilitators[name].forEach((session: SessionExportData) => {
        summaryRows.push([no++, name, session.subject || '-', formatDateID(session.sessionDate), session.overall]);
        grandTotal += session.overallVal;
        grandCount++;
    });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  summaryRows.push(['', '', '', 'RATA-RATA TOTAL', grandDisplay]);

  const rekapWs = XLSX.utils.aoa_to_sheet([...infoData, ['B. REKAPITULASI NILAI KESELURUHAN'], [], summaryHeader, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, rekapWs, 'B. Rekapitulasi');


  // --- SHEET 3: PENYELENGGARAAN (Section C) ---
  const procRows: any[] = [...infoData, ['C. EVALUASI PENYELENGGARAAN']];
  
  if (training.processOrganizer && training.processOrganizer.name) {
      procRows.push([`Penanggung Jawab: ${training.processOrganizer.name}`]);
  }
  
  procRows.push([]);
  procRows.push(['Variabel', 'Nilai']);
  
  training.processQuestions.filter(q => q.type !== 'text').forEach(q => {
      procRows.push([q.label, data.process.averages[q.id]]);
  });
  procRows.push(['Rata-rata Keseluruhan', data.process.overall]);
  
  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  if (procTextQs.length > 0) {
      procRows.push([]);
      procRows.push(['Komentar / Saran Penyelenggaraan:']);
      procTextQs.forEach(q => {
          const cmts = data.process.comments[q.id];
          if (cmts && cmts.length > 0) {
             procRows.push([`[${q.label}]`]);
             cmts.forEach((c: string) => procRows.push([` - ${c}`]));
          }
      });
  }

  const procWs = XLSX.utils.aoa_to_sheet(procRows);
  XLSX.utils.book_append_sheet(wb, procWs, 'C. Penyelenggaraan');

  XLSX.writeFile(wb, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.xlsx`);
};

export const exportToWord = async (training: Training) => {
  const responses = await getResponses(training.id);
  const data = processDataForExport(training, responses);

  const sections: any[] = [];

  // Title
  sections.push(new Paragraph({
    text: "Laporan Rekapitulasi Evaluasi Pelatihan",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
  }));

  sections.push(new Paragraph({
    children: [
      new TextRun({ text: `Judul Pelatihan: ${training.title}`, bold: true }),
      new TextRun({ text: `\nPeriode: ${formatDateID(training.startDate)} - ${formatDateID(training.endDate)}`, break: 1 }),
      new TextRun({ text: `\nJumlah Responden: ${responses.length}`, break: 1 }),
    ],
    spacing: { after: 400 },
  }));

  // --- A. DETAIL FASILITATOR (FLAT CHRONOLOGICAL) ---
  sections.push(new Paragraph({ text: "A. Evaluasi Detail Fasilitator", heading: HeadingLevel.HEADING_2 }));
  
  const flatSessions = getFlatChronologicalSessions(data.facilitators);

  flatSessions.forEach((session) => {
    sections.push(new Paragraph({ 
        children: [new TextRun({ text: `Nama Fasilitator: ${session.name}`, color: "4F46E5", bold: true })], 
        spacing: { before: 200 } 
    }));
    
    const sessionDateStr = session.sessionDate ? ` (${formatDateID(session.sessionDate)})` : '';
    sections.push(new Paragraph({ text: `Materi: ${session.subject}${sessionDateStr}`, bold: true, spacing: { before: 100 } }));

    // Table Scores
    const rows = [
        new TableRow({
            children: [
            new TableCell({ children: [new Paragraph({ text: "Variabel", bold: true })], width: { size: 60, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "Nilai & Predikat", bold: true })], width: { size: 40, type: WidthType.PERCENTAGE } }),
            ],
        }),
    ];

    training.facilitatorQuestions.filter(q => q.type !== 'text').forEach(q => {
        rows.push(new TableRow({
            children: [
            new TableCell({ children: [new Paragraph(q.label)] }),
            new TableCell({ children: [new Paragraph(session.averages[q.id] || "0.00")] }),
            ],
        }));
    });

    rows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: "Rata-rata Keseluruhan", bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: session.overall, bold: true })] }),
        ],
    }));

    sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        }
    }));

    const textQs = training.facilitatorQuestions.filter(q => q.type === 'text');
    textQs.forEach(q => {
        const comments = session.comments[q.id];
        if (comments && comments.length > 0) {
            sections.push(new Paragraph({ text: `Komentar - ${q.label}:`, bold: true, spacing: { before: 100 } }));
            comments.forEach((c: string) => {
                sections.push(new Paragraph({ text: `• ${c}`, bullet: { level: 0 } }));
            });
        }
    });
    sections.push(new Paragraph({ text: "", spacing: { after: 200 } })); 
  });

  // --- B. REKAPITULASI (GROUPED BY NAME, SORTED DATE) ---
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(new Paragraph({ text: "B. Rekapitulasi Nilai Keseluruhan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  
  const summaryRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "No", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Fasilitator", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Materi", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Nilai Akhir", bold: true })] }),
        ],
      }),
  ];

  let no = 1;
  let grandTotal = 0;
  let grandCount = 0;

  const sortedNames = getSortedFacilitatorNamesForRecap(data.facilitators, training);

  sortedNames.forEach((name) => {
      data.facilitators[name].forEach((session: SessionExportData) => {
        summaryRows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph((no++).toString())] }),
                new TableCell({ children: [new Paragraph(name)] }),
                new TableCell({ children: [new Paragraph(session.subject || '-')] }),
                new TableCell({ children: [new Paragraph({ text: session.overall, bold: true })] }),
            ]
        }));
        grandTotal += session.overallVal;
        grandCount++;
      });
  });

  const grandAvg = grandCount > 0 ? grandTotal / grandCount : 0;
  const grandLabelType: QuestionType = grandAvg > 5 ? 'slider' : 'star';
  const grandDisplay = `${grandAvg.toFixed(2)} (${getScoreLabel(grandAvg, grandLabelType)})`;

  summaryRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph({ text: "RATA-RATA TOTAL", bold: true })] }),
        new TableCell({ children: [new Paragraph({ text: grandDisplay, bold: true })] }),
      ]
  }));

  sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: summaryRows,
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      }
  }));


  // --- C. PENYELENGGARAAN ---
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(new Paragraph({ text: "C. Evaluasi Penyelenggaraan", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  
  if (training.processOrganizer && training.processOrganizer.name) {
       sections.push(new Paragraph({ text: `Penanggung Jawab: ${training.processOrganizer.name}`, spacing: { after: 100 } }));
  }

  const procRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Variabel", bold: true })], width: { size: 60, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "Nilai & Predikat", bold: true })], width: { size: 40, type: WidthType.PERCENTAGE } }),
        ],
      }),
  ];

  training.processQuestions.filter(q => q.type !== 'text').forEach(q => {
      procRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(q.label)] }),
          new TableCell({ children: [new Paragraph(data.process.averages[q.id] || "0.00")] }),
        ],
      }));
  });

  procRows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: "Rata-rata Keseluruhan", bold: true })] }),
      new TableCell({ children: [new Paragraph({ text: data.process.overall, bold: true })] }),
    ],
  }));

  sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: procRows,
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      }
  }));

  const procTextQs = training.processQuestions.filter(q => q.type === 'text');
  procTextQs.forEach(q => {
      const comments = data.process.comments[q.id];
      if (comments && comments.length > 0) {
          sections.push(new Paragraph({ text: `Komentar - ${q.label}:`, bold: true, spacing: { before: 100 } }));
          comments.forEach((c: string) => {
              sections.push(new Paragraph({ text: `• ${c}`, bullet: { level: 0 } }));
          });
      }
  });

  const doc = new Document({
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Laporan_SIMEP_${training.title.replace(/\s+/g, '_')}.docx`);
};
