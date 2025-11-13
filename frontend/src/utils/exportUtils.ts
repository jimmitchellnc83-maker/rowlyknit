import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Export project to PDF
export async function exportProjectToPDF(project: any): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - 50;
  const leftMargin = 50;
  const lineHeight = 20;

  // Title
  page.drawText('Rowly - Project Details', {
    x: leftMargin,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0.54, 0.36, 0.96), // Purple
  });

  yPosition -= 40;

  // Project Name
  page.drawText(project.name, {
    x: leftMargin,
    y: yPosition,
    size: 18,
    font: boldFont,
  });

  yPosition -= 30;

  // Status
  page.drawText(`Status: ${project.status || 'N/A'}`, {
    x: leftMargin,
    y: yPosition,
    size: 12,
    font,
  });

  yPosition -= lineHeight;

  // Project Type
  if (project.project_type) {
    page.drawText(`Type: ${project.project_type}`, {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font,
    });
    yPosition -= lineHeight;
  }

  // Dates
  if (project.start_date) {
    page.drawText(`Started: ${new Date(project.start_date).toLocaleDateString()}`, {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font,
    });
    yPosition -= lineHeight;
  }

  if (project.target_completion_date) {
    page.drawText(`Target: ${new Date(project.target_completion_date).toLocaleDateString()}`, {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font,
    });
    yPosition -= lineHeight;
  }

  yPosition -= 10;

  // Description
  if (project.description) {
    page.drawText('Description:', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= lineHeight;

    const descLines = wrapText(project.description, width - 2 * leftMargin, 12, font);
    descLines.forEach((line) => {
      if (yPosition < 100) {
        // Skip remaining content if page is full (pagination not fully implemented)
        return;
      }
      page.drawText(line, {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= lineHeight;
    });

    yPosition -= 10;
  }

  // Notes
  if (project.notes) {
    page.drawText('Notes:', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= lineHeight;

    const notesLines = wrapText(project.notes, width - 2 * leftMargin, 12, font);
    notesLines.forEach((line) => {
      if (yPosition < 100) {
        // Skip remaining content if page is full (pagination not fully implemented)
        return;
      }
      page.drawText(line, {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= lineHeight;
    });
  }

  // Counters
  if (project.counters && project.counters.length > 0) {
    yPosition -= 20;
    page.drawText('Row Counters:', {
      x: leftMargin,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= lineHeight;

    project.counters.forEach((counter: any) => {
      page.drawText(`• ${counter.name}: ${counter.current_count}${counter.target_count ? ` / ${counter.target_count}` : ''}`, {
        x: leftMargin + 10,
        y: yPosition,
        size: 12,
        font,
      });
      yPosition -= lineHeight;
    });
  }

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Export projects to CSV
export function exportProjectsToCSV(projects: any[]): void {
  const headers = [
    'Name',
    'Status',
    'Type',
    'Description',
    'Start Date',
    'Target Completion',
    'Completion Date',
    'Created At',
  ];

  const csvContent = [
    headers.join(','),
    ...projects.map((p) => [
      escapeCSV(p.name),
      escapeCSV(p.status),
      escapeCSV(p.project_type),
      escapeCSV(p.description),
      p.start_date || '',
      p.target_completion_date || '',
      p.completion_date || '',
      p.created_at || '',
    ].join(',')),
  ].join('\n');

  downloadCSV(csvContent, 'rowly_projects.csv');
}

// Export patterns to CSV
export function exportPatternsToCSV(patterns: any[]): void {
  const headers = [
    'Name',
    'Designer',
    'Type',
    'Difficulty',
    'Needle Size',
    'Gauge',
    'Notes',
  ];

  const csvContent = [
    headers.join(','),
    ...patterns.map((p) => [
      escapeCSV(p.name),
      escapeCSV(p.designer),
      escapeCSV(p.pattern_type),
      escapeCSV(p.difficulty_level),
      escapeCSV(p.needle_size),
      escapeCSV(p.gauge),
      escapeCSV(p.notes),
    ].join(',')),
  ].join('\n');

  downloadCSV(csvContent, 'rowly_patterns.csv');
}

// Export yarn to CSV
export function exportYarnToCSV(yarns: any[]): void {
  const headers = [
    'Brand',
    'Name',
    'Weight',
    'Fiber Content',
    'Color',
    'Lot Number',
    'Skeins',
    'Yardage',
  ];

  const csvContent = [
    headers.join(','),
    ...yarns.map((y) => [
      escapeCSV(y.brand),
      escapeCSV(y.name),
      escapeCSV(y.weight),
      escapeCSV(y.fiber_content),
      escapeCSV(y.color_name),
      escapeCSV(y.lot_number),
      y.skeins_owned || '',
      y.yardage_per_skein || '',
    ].join(',')),
  ].join('\n');

  downloadCSV(csvContent, 'rowly_yarn.csv');
}

// Helper: Escape CSV fields
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper: Download CSV
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
