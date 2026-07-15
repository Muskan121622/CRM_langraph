import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateManagerReport = (interactions) => {
  if (!interactions || interactions.length === 0) return;

  const doc = new jsPDF();
  const pageMargin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text("MediFlow CRM", pageMargin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(55, 65, 81); // gray-700
  doc.text("Manager Visit Summary Report", pageMargin, 30);

  // 2. Date
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // gray-500
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Generated on: ${dateStr}`, pageMargin, 36);

  // 3. Summary Statistics
  const totalVisits = interactions.length;
  const totalSamples = interactions.reduce((sum, i) => sum + (i.samples_distributed || 0), 0);
  const positiveInteractions = interactions.filter(i => i.sentiment === 'Positive').length;

  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(pageMargin, 42, pageWidth - (pageMargin * 2), 25, 3, 3, 'FD');

  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55); // gray-800
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", pageMargin + 5, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total HCP Visits: ${totalVisits}`, pageMargin + 5, 58);
  doc.text(`Total Samples Distributed: ${totalSamples}`, pageMargin + 65, 58);
  doc.text(`Positive Sentiment Ratio: ${Math.round((positiveInteractions / totalVisits) * 100) || 0}%`, pageMargin + 130, 58);

  // 4. Data Table
  const tableColumn = ["Date", "Doctor", "Specialty", "Products", "Sentiment", "Samples", "Notes/Follow-up"];
  const tableRows = [];

  interactions.forEach(interaction => {
    const interactionData = [
      new Date(interaction.date).toLocaleDateString(),
      interaction.doctor?.name || 'Unknown',
      interaction.doctor?.specialty || '-',
      interaction.products?.map(p => p.name).join(', ') || '-',
      interaction.sentiment || '-',
      `${interaction.samples_distributed || 0} dist, ${interaction.samples_requested || 0} req`,
      interaction.notes || '-'
    ];
    tableRows.push(interactionData);
  });

  autoTable(doc, {
    startY: 75,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [29, 78, 216], // blue-700
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 55, // gray-700
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // gray-50
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 'auto' }
    },
    margin: { top: 15, right: pageMargin, bottom: 15, left: pageMargin }
  });

  // 5. Save the PDF
  doc.save(`MediFlow_Manager_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};
