import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MACRO_CATEGORY_LABELS,
  PRICING_MODE_LABELS,
  formatQuoteCodeWithRev,
  formatRevision,
  type ActivityLog,
  type Client,
  type Project,
  type Quote,
} from '../types';

export function formatItalianDate(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Helper that renders one complete copy of the Reportino (either "COPIA PER IL CLIENTE"
 * or "COPIA PER L'AMMINISTRAZIONE DELL'AZIENDA") on the current page of `doc`.
 */
function renderReportinoCopy(
  doc: jsPDF,
  copyLabel: string,
  params: {
    activities: ActivityLog[];
    project?: Project | null;
    client?: Client | null;
    dateFilterLabel: string;
    printedBy: string;
    printedAtStr: string;
    clientSignerName: string;
    clientSignatureDataUrl?: string;
    technicianSignatureDataUrl?: string;
  }
) {
  const {
    activities,
    project,
    client,
    dateFilterLabel,
    printedBy,
    printedAtStr,
    clientSignerName,
    clientSignatureDataUrl,
    technicianSignatureDataUrl,
  } = params;

  // Top Header Band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text('REPORTINO DI INTERVENTO E CONSUNTIVAZIONE ATTIVITÀ', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Periodo / Filtro Data: ${dateFilterLabel}`, 14, 19);
  doc.setFont('helvetica', 'bold');
  doc.text(copyLabel, 14, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Data di stampa: ${printedAtStr}`, 196, 12, { align: 'right' });
  doc.text(`Emesso da: ${printedBy}`, 196, 19, { align: 'right' });

  let y = 38;

  // Derive Client, Facility, Project & Offer References
  const firstAct = activities[0];
  const clientName =
    project?.clientName || client?.companyName || firstAct?.clientName || 'Tutti i Clienti';
  const clientVat = project?.clientVat || client?.vatNumber || '-';
  const clientSdi = client?.sdiCode || '-';
  const facilityName =
    project?.facilityName ||
    firstAct?.facilityName ||
    client?.facilities?.[0]?.name ||
    'Sede Operativa';
  const facilityAddress =
    project?.facilityAddress ||
    firstAct?.facilityAddress ||
    client?.facilities?.[0]?.address ||
    '';
  const facilityCity =
    project?.clientCity ||
    client?.facilities?.[0]?.city ||
    client?.city ||
    '';

  const projectTitle = project?.title || firstAct?.projectTitle || 'Più Progetti';
  const quoteRef =
    project?.quoteNumber ||
    firstAct?.quoteNumber ||
    client?.sourceQuoteNumber ||
    '-';
  const orderRef = project?.orderNumber || firstAct?.orderNumber || '-';

  // Box 1: Cliente, Stabilimento, Progetto e Riferimento Offerta
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 38, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. DATI CLIENTE, STABILIMENTO, PROGETTO E RIFERIMENTO OFFERTA', 18, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Cliente: ${clientName}   (P.IVA: ${clientVat}  |  SDI: ${clientSdi})`, 18, y + 13.5);
  doc.text(
    `Stabilimento: ${facilityName}${facilityAddress ? ` — Via: ${facilityAddress}` : ''}${facilityCity ? ` (${facilityCity})` : ''}`,
    18,
    y + 20
  );

  doc.setFont('helvetica', 'bold');
  doc.text(`Progetto: ${projectTitle}`, 18, y + 27);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Rif. Offerta: ${quoteRef}   |   Rif. Ordine Cliente: ${orderRef}`,
    18,
    y + 33.5
  );

  y += 44;

  // Summary Metrics Bar
  const totalHours = activities.reduce((acc, a) => acc + a.durationHours, 0);
  const equivalentDays = Number((totalHours / 8).toFixed(2));
  const fullDaysCount = activities.filter((a) => a.isFullDay).length;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(14, y, 182, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Attività Eseguite nel Periodo: ${activities.length}`, 18, y + 7.5);
  doc.text(
    `Totale Ore: ${totalHours.toFixed(2)} h  (${equivalentDays} giornate eq. da 8h)`,
    82,
    y + 7.5
  );
  if (fullDaysCount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Giornate intere (8h): ${fullDaysCount}`, 158, y + 7.5);
  }

  y += 16;

  // Sort activities chronologically
  const sorted = [...activities].sort((a, b) => {
    const cmpDate = a.executionDate.localeCompare(b.executionDate);
    if (cmpDate !== 0) return cmpDate;
    return a.startTime.localeCompare(b.startTime);
  });

  const tableBody = sorted.map((act, index) => [
    String(index + 1),
    formatItalianDate(act.executionDate),
    act.isFullDay
      ? 'Giornata Intera (8h)'
      : `${act.startTime} - ${act.endTime}`,
    act.lineItemTitle || act.projectTitle,
    act.description || '-',
    act.technicianName,
    `${act.durationHours.toFixed(2)} h`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        '#',
        'Data Esec.',
        'Orario / Giornata',
        'Attività / Equipment / Strumento',
        'Dettaglio Attività Eseguita',
        'Tecnico',
        'Ore',
      ],
    ],
    body: tableBody,
    foot: [
      [
        '',
        '',
        '',
        '',
        'TOTALE COMPLESSIVO PERIODO:',
        `${equivalentDays} gg eq.`,
        `${totalHours.toFixed(2)} h`,
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
  });

  let signY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
      y + 30) + 10;

  if (signY > 228) {
    doc.addPage();
    signY = 25;
  }

  // Footer Section: Print Date + Digital Signatures + Dual Copy Notice
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, signY, 182, 46, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `2. CONVALIDA E FIRMA DIGITALE IN CALCE  —  Data di Stampa: ${printedAtStr}`,
    18,
    signY + 6.5
  );

  // Left signature box: Technician
  doc.setFillColor(255, 255, 255);
  doc.rect(18, signY + 9.5, 84, 27, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('FIRMA DIGITALE TECNICO ESECUTORE', 21, signY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Tecnico: ${printedBy}`, 21, signY + 19.5);

  const techSig =
    technicianSignatureDataUrl ||
    activities.find((a) => a.technicianSignatureDataUrl)?.technicianSignatureDataUrl ||
    '';

  if (techSig && techSig.startsWith('data:image/')) {
    try {
      doc.addImage(techSig, 'PNG', 21, signY + 20.5, 55, 14);
    } catch {
      // ignore
    }
  } else {
    doc.setTextColor(148, 163, 184);
    doc.text('Firma: ___________________________', 21, signY + 32);
  }

  // Right signature box: Client
  doc.setFillColor(255, 255, 255);
  doc.rect(108, signY + 9.5, 84, 27, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('FIRMA DIGITALE PER ACCETTAZIONE CLIENTE', 111, signY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Referente: ${clientSignerName || firstAct?.clientSignerName || clientName}`,
    111,
    signY + 19.5
  );

  const cliSig =
    clientSignatureDataUrl ||
    activities.find((a) => a.clientSignatureDataUrl)?.clientSignatureDataUrl ||
    '';

  if (cliSig && cliSig.startsWith('data:image/')) {
    try {
      doc.addImage(cliSig, 'PNG', 111, signY + 20.5, 55, 14);
    } catch {
      // ignore
    }
  } else {
    doc.setTextColor(148, 163, 184);
    doc.text('Firma: ___________________________', 111, signY + 32);
  }

  // Dual copy legal footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${copyLabel} — Documento emesso in duplice esemplare firmato digitalmente (1 copia per il Cliente, 1 copia per l'Amministrazione dell'Azienda).`,
    18,
    signY + 42.5
  );
}

/**
 * Generates the official Reportino PDF filtered by Date and/or Project,
 * automatically producing both the Client Copy and the Company Administration Copy
 * with print date and digital signatures in the footer.
 */
export function generateConsuntivoPdf(params: {
  activities: ActivityLog[];
  project?: Project | null;
  client?: Client | null;
  filterDescription: string;
  generatedBy: string;
  clientSignerName?: string;
  clientSignatureDataUrl?: string;
  technicianSignatureDataUrl?: string;
}) {
  const {
    activities,
    project,
    client,
    filterDescription,
    generatedBy,
    clientSignerName = '',
    clientSignatureDataUrl = '',
    technicianSignatureDataUrl = '',
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const printedAtStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Page 1: COPIA 1 — ESEMPLARE PER IL CLIENTE
  renderReportinoCopy(doc, 'ESEMPLARE 1 DI 2 — COPIA PER IL CLIENTE', {
    activities,
    project,
    client,
    dateFilterLabel: filterDescription,
    printedBy: generatedBy,
    printedAtStr,
    clientSignerName,
    clientSignatureDataUrl,
    technicianSignatureDataUrl,
  });

  // Page 2: COPIA 2 — ESEMPLARE PER L'AMMINISTRAZIONE DELL'AZIENDA
  doc.addPage();
  renderReportinoCopy(
    doc,
    "ESEMPLARE 2 DI 2 — COPIA PER L'AMMINISTRAZIONE DELL'AZIENDA",
    {
      activities,
      project,
      client,
      dateFilterLabel: filterDescription,
      printedBy: generatedBy,
      printedAtStr,
      clientSignerName,
      clientSignatureDataUrl,
      technicianSignatureDataUrl,
    }
  );

  const fileSlug = project
    ? `Reportino_${project.quoteNumber.replace(/[^a-zA-Z0-9]/g, '_')}`
    : `Reportino_Attivita_${new Date().toISOString().slice(0, 10)}`;

  doc.save(`${fileSlug}.pdf`);
}

export function generateReportinoInterventoPdf(params: {
  activity: ActivityLog;
  project?: Project | null;
  client?: Client | null;
}) {
  const { activity, project, client } = params;
  generateConsuntivoPdf({
    activities: [activity],
    project,
    client,
    filterDescription: `Giorno di esecuzione: ${formatItalianDate(activity.executionDate)}`,
    generatedBy: activity.technicianName,
    clientSignerName: activity.clientSignerName,
    clientSignatureDataUrl: activity.clientSignatureDataUrl,
    technicianSignatureDataUrl: activity.technicianSignatureDataUrl,
  });
}

/**
 * Generates Official Commercial Offer PDF with Revision (Rev. 0, 1, 2...),
 * Client + Selected Facility/Address, Macro Category, and Detailed Valuation Table
 */
export function generateQuotePdf(quote: Quote) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const fullCodeWithRev = formatQuoteCodeWithRev(quote.quoteNumber, quote.revision);
  const macroLabel = MACRO_CATEGORY_LABELS[quote.macroCategory] || 'Qualifica';
  const modeLabel = PRICING_MODE_LABELS[quote.pricingMode] || 'A Consuntivo';

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OFFERTA TECNICO-COMMERCIALE', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Numero Offerta: ${quote.quoteNumber}   |   Revisione: Rev. ${formatRevision(quote.revision)}   |   Macro-Categoria: ${macroLabel.toUpperCase()}`,
    14,
    22
  );

  doc.setFontSize(8.5);
  doc.text(
    `Data: ${formatItalianDate(quote.createdAt || new Date().toISOString().slice(0, 10))}`,
    196,
    13,
    { align: 'right' }
  );
  doc.text(`Emessa da: ${quote.createdByName}`, 196, 22, { align: 'right' });

  let y = 39;

  // Box Destinatario, Stabilimento & Classificazione Offerta
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 36, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. SPETT.LE CLIENTE, STABILIMENTO & STRUTTURA OFFERTA', 18, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Ragione Sociale: ${quote.clientName}`, 18, y + 13);
  doc.text(`P.IVA / C.F.: ${quote.clientVat}   |   Cod. SDI: ${quote.clientSdi}`, 115, y + 13);
  doc.text(
    `Stabilimento: ${quote.facilityName || 'Sede Principale'} — Via: ${quote.facilityAddress || '-'} (${quote.clientCity || '-'})`,
    18,
    y + 20
  );

  doc.setFont('helvetica', 'bold');
  doc.text(
    `Macro-Categoria: ${macroLabel}   —   Modalità: ${modeLabel}`,
    18,
    y + 28.5
  );

  y += 43;

  // Oggetto & Descrizione Tecnica
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. OGGETTO: ${quote.projectTitle}`, 14, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitScope = doc.splitTextToSize(quote.projectDescription || '-', 182);
  doc.text(splitScope, 14, y);

  y += splitScope.length * 4.5 + 6;

  // Tabella Valorizzazione Economica
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('3. VALORIZZAZIONE ECONOMICA OFFERTA', 14, y);
  y += 4;

  if (quote.pricingMode === 'consuntivo_giornate') {
    const dr = quote.dailyRates;
    const engRate = dr?.engineer ?? quote.dailyRate ?? 0;
    const specRate = dr?.specialist ?? 0;
    const consRate = dr?.consultant ?? 0;

    autoTable(doc, {
      startY: y,
      head: [
        [
          'Rif. Offerta',
          'Macro-Categoria & Modalità',
          'Engineer (Daily Rate)',
          'Specialist (Daily Rate)',
          'Consultant (Daily Rate)',
        ],
      ],
      body: [
        [
          fullCodeWithRev,
          `${macroLabel} — A Consuntivo (Daily Rate)`,
          engRate > 0 ? `${formatCurrency(engRate)} / gg` : '-',
          specRate > 0 ? `${formatCurrency(specRate)} / gg` : '-',
          consRate > 0 ? `${formatCurrency(consRate)} / gg` : '-',
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
      },
    });

    if (quote.lineItems && quote.lineItems.length > 0) {
      const nextY =
        ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
          y + 25) + 6;
      const qualRows = quote.lineItems.map((item, idx) => {
        const testsList = (item.plannedTests || []).filter((t) => t && t.trim().length > 0);
        return [
          String(idx + 1),
          item.activityOrSpec || item.itemType || '-',
          item.itemType && item.itemType !== item.activityOrSpec ? item.itemType : '-',
          testsList.length > 0 ? testsList.map((t) => `• ${t}`).join('\n') : '-',
        ];
      });
      autoTable(doc, {
        startY: nextY,
        head: [['#', 'Attività / Protocollo', 'Equipment / Impianto', 'Test / Test Previsti']],
        body: qualRows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
        },
      });
    }
  } else if (quote.pricingMode === 'consuntivo_strumento') {
    const rows = (quote.lineItems || []).map((item, idx) => [
      String(idx + 1),
      item.itemType,
      item.activityOrSpec || '-',
      `${formatCurrency(item.unitPrice)} / strumento`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        [
          '#',
          'Tipologia Strumento',
          'Campo di Misura / Specifica Taratura',
          'Quotazione Unitaria (IVA escl.)',
        ],
      ],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 48, halign: 'right', fontStyle: 'bold' },
      },
    });
  } else {
    const isQualifica = quote.macroCategory === 'qualifica';
    const col1Header =
      quote.pricingMode === 'a_strumento'
        ? 'Tipologia / Identificativo Strumento'
        : 'Equipment / Impianto';
    const col2Header =
      quote.pricingMode === 'a_strumento'
        ? 'Campo di Misura / Specifica Taratura'
        : 'Attività / Protocollo (IQ/OQ/IOQ/PQ)';

    const headCols = isQualifica
      ? ['#', col2Header, col1Header, 'Test / Test Previsti', 'Q.tà', 'Importo Unit.', 'Totale Riga']
      : ['#', col1Header, col2Header, 'Q.tà', 'Importo Unitario', 'Totale Riga (IVA escl.)'];

    const rows = (quote.lineItems || []).map((item, idx) => {
      const testsList = (item.plannedTests || []).filter((t) => t && t.trim().length > 0);
      const testsCell = testsList.length > 0 ? testsList.map((t) => `• ${t}`).join('\n') : '-';
      if (isQualifica) {
        return [
          String(idx + 1),
          item.activityOrSpec || item.itemType || '-',
          item.itemType || '-',
          testsCell,
          String(item.quantity),
          formatCurrency(item.unitPrice),
          formatCurrency(item.totalPrice),
        ];
      }
      return [
        String(idx + 1),
        item.itemType,
        item.activityOrSpec || '-',
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [headCols],
      body: rows,
      foot: [
        isQualifica
          ? ['', '', '', '', '', 'TOTALE FORFAIT OFFERTA:', formatCurrency(quote.totalAmount)]
          : ['', '', '', '', 'TOTALE FORFAIT OFFERTA:', formatCurrency(quote.totalAmount)],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
    });
  }

  const afterTableY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ||
      y + 30) + 8;

  let boxY = afterTableY;

  if (quote.systemInfo && quote.systemInfo.trim()) {
    if (boxY > 225) {
      doc.addPage();
      boxY = 25;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('INFORMAZIONI SUL SISTEMA', 14, boxY);
    boxY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const splitSys = doc.splitTextToSize(quote.systemInfo.trim(), 182);
    doc.text(splitSys, 14, boxY);
    boxY += splitSys.length * 4.5 + 8;
  }

  if (quote.extraCosts && quote.extraCosts.trim()) {
    if (boxY > 225) {
      doc.addPage();
      boxY = 25;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('COSTI EXTRA / NOTE ECONOMICHE AGGIUNTIVE', 14, boxY);
    boxY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const splitExtra = doc.splitTextToSize(quote.extraCosts.trim(), 182);
    doc.text(splitExtra, 14, boxY);
    boxY += splitExtra.length * 4.5 + 8;
  }

  if (boxY > 240) {
    doc.addPage();
    boxY = 25;
  }

  doc.setDrawColor(148, 163, 184);
  doc.rect(14, boxY, 182, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`MODULO DI ACCETTAZIONE E ORDINE (${fullCodeWithRev})`, 18, boxY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    "Alla ricezione dell'ordine riferito alla presente offerta, verrà attivato il Progetto per la consuntivazione delle attività eseguite.",
    18,
    boxY + 13
  );
  doc.text(
    `Numero Ordine Cliente: ${quote.orderNumber || '_______________________'}     Data: ${quote.orderDate ? formatItalianDate(quote.orderDate) : '___/___/2026'}     Timbro e Firma: _______________________`,
    18,
    boxY + 23
  );

  doc.save(`Offerta_${quote.quoteNumber}_Rev${formatRevision(quote.revision)}.pdf`);
}
