import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiPlus, FiTrash2, FiGrid, FiLoader } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PatternRow {
  id: string;
  rowNumber: number;
  instructions: string;
  stitchCount?: number;
  notes?: string;
}

interface PatternSection {
  id: string;
  name: string;
  rows: PatternRow[];
}

interface PatternData {
  name: string;
  designer: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: string;
  gauge: string;
  needleSize: string;
  yarnWeight: string;
  yarnYardage: string;
  sizes: string;
  notes: string;
  sections: PatternSection[];
}

const initialPatternData: PatternData = {
  name: '',
  designer: '',
  difficulty: 'intermediate',
  category: 'sweater',
  gauge: '',
  needleSize: '',
  yarnWeight: '',
  yarnYardage: '',
  sizes: '',
  notes: '',
  sections: [
    {
      id: crypto.randomUUID(),
      name: 'Main Section',
      rows: [],
    },
  ],
};

export default function KnittingPatternBuilder() {
  const navigate = useNavigate();
  const [pattern, setPattern] = useState<PatternData>(initialPatternData);
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const updatePattern = (field: keyof PatternData, value: any) => {
    setPattern((prev) => ({ ...prev, [field]: value }));
  };

  const addSection = () => {
    setPattern((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: crypto.randomUUID(),
          name: `Section ${prev.sections.length + 1}`,
          rows: [],
        },
      ],
    }));
    setActiveSection(pattern.sections.length);
  };

  const removeSection = (index: number) => {
    if (pattern.sections.length <= 1) {
      toast.error('Pattern must have at least one section');
      return;
    }
    setPattern((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
    if (activeSection >= index && activeSection > 0) {
      setActiveSection(activeSection - 1);
    }
  };

  const updateSectionName = (index: number, name: string) => {
    setPattern((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) =>
        i === index ? { ...section, name } : section
      ),
    }));
  };

  const addRow = (sectionIndex: number) => {
    setPattern((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i === sectionIndex) {
          const newRowNumber = section.rows.length + 1;
          return {
            ...section,
            rows: [
              ...section.rows,
              {
                id: crypto.randomUUID(),
                rowNumber: newRowNumber,
                instructions: '',
                stitchCount: undefined,
                notes: '',
              },
            ],
          };
        }
        return section;
      }),
    }));
  };

  const updateRow = (
    sectionIndex: number,
    rowIndex: number,
    field: keyof PatternRow,
    value: any
  ) => {
    setPattern((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i === sectionIndex) {
          return {
            ...section,
            rows: section.rows.map((row, j) =>
              j === rowIndex ? { ...row, [field]: value } : row
            ),
          };
        }
        return section;
      }),
    }));
  };

  const removeRow = (sectionIndex: number, rowIndex: number) => {
    setPattern((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i === sectionIndex) {
          return {
            ...section,
            rows: section.rows.filter((_, j) => j !== rowIndex),
          };
        }
        return section;
      }),
    }));
  };

  // Export to PDF
  const exportToPDF = useCallback(async () => {
    if (!pattern.name) {
      toast.error('Please enter a pattern name before exporting');
      return;
    }

    setExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageWidth = 612; // Letter size
      const pageHeight = 792;
      const margin = 50;
      const lineHeight = 16;
      const contentWidth = pageWidth - 2 * margin;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      const addNewPage = () => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      };

      const checkPageBreak = (requiredSpace: number) => {
        if (yPosition < margin + requiredSpace) {
          addNewPage();
        }
      };

      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
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
      };

      // Title
      page.drawText(pattern.name, {
        x: margin,
        y: yPosition,
        size: 24,
        font: boldFont,
        color: rgb(0.54, 0.36, 0.96),
      });
      yPosition -= 30;

      // Designer
      if (pattern.designer) {
        page.drawText(`by ${pattern.designer}`, {
          x: margin,
          y: yPosition,
          size: 14,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 25;
      }

      // Pattern info section
      yPosition -= 10;
      page.drawText('Pattern Information', {
        x: margin,
        y: yPosition,
        size: 14,
        font: boldFont,
      });
      yPosition -= 20;

      const infoItems = [
        { label: 'Difficulty', value: pattern.difficulty },
        { label: 'Category', value: pattern.category },
        { label: 'Gauge', value: pattern.gauge },
        { label: 'Needle Size', value: pattern.needleSize },
        { label: 'Yarn Weight', value: pattern.yarnWeight },
        { label: 'Yarn Required', value: pattern.yarnYardage },
        { label: 'Sizes', value: pattern.sizes },
      ].filter((item) => item.value);

      infoItems.forEach((item) => {
        checkPageBreak(lineHeight);
        page.drawText(`${item.label}: ${item.value}`, {
          x: margin,
          y: yPosition,
          size: 11,
          font,
        });
        yPosition -= lineHeight;
      });

      // Notes
      if (pattern.notes) {
        yPosition -= 15;
        checkPageBreak(40);
        page.drawText('Notes', {
          x: margin,
          y: yPosition,
          size: 14,
          font: boldFont,
        });
        yPosition -= 18;

        const noteLines = wrapText(pattern.notes, contentWidth, 11);
        noteLines.forEach((line) => {
          checkPageBreak(lineHeight);
          page.drawText(line, {
            x: margin,
            y: yPosition,
            size: 11,
            font,
          });
          yPosition -= lineHeight;
        });
      }

      // Pattern Sections
      pattern.sections.forEach((section) => {
        yPosition -= 25;
        checkPageBreak(60);

        // Section header
        page.drawText(section.name, {
          x: margin,
          y: yPosition,
          size: 16,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.6),
        });
        yPosition -= 25;

        // Rows
        section.rows.forEach((row) => {
          checkPageBreak(40);

          // Row number
          page.drawText(`Row ${row.rowNumber}:`, {
            x: margin,
            y: yPosition,
            size: 11,
            font: boldFont,
          });

          // Stitch count
          if (row.stitchCount) {
            page.drawText(`(${row.stitchCount} sts)`, {
              x: margin + 60,
              y: yPosition,
              size: 10,
              font,
              color: rgb(0.5, 0.5, 0.5),
            });
          }
          yPosition -= 14;

          // Instructions
          if (row.instructions) {
            const instrLines = wrapText(row.instructions, contentWidth - 20, 11);
            instrLines.forEach((line) => {
              checkPageBreak(lineHeight);
              page.drawText(line, {
                x: margin + 10,
                y: yPosition,
                size: 11,
                font,
              });
              yPosition -= lineHeight;
            });
          }

          // Row notes
          if (row.notes) {
            checkPageBreak(lineHeight);
            page.drawText(`Note: ${row.notes}`, {
              x: margin + 10,
              y: yPosition,
              size: 10,
              font,
              color: rgb(0.4, 0.4, 0.4),
            });
            yPosition -= lineHeight;
          }

          yPosition -= 8;
        });
      });

      // Footer on last page
      const footerText = `Generated by Rowly - ${new Date().toLocaleDateString()}`;
      page.drawText(footerText, {
        x: margin,
        y: 30,
        size: 9,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });

      // Save and download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pattern.name.replace(/[^a-z0-9]/gi, '_')}_pattern.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Pattern exported to PDF successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export pattern to PDF');
    } finally {
      setExporting(false);
    }
  }, [pattern]);

  const currentSection = pattern.sections[activeSection];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/patterns')}
              className="flex items-center text-purple-600 hover:text-purple-700"
            >
              <FiArrowLeft className="mr-2" />
              Back to Patterns
            </button>
            <h1 className="text-xl font-bold text-gray-900">Knitting Pattern Builder</h1>
          </div>
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <FiLoader className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FiDownload />
                Export Pattern (PDF)
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pattern Info Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Pattern Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern Name *
                  </label>
                  <input
                    type="text"
                    value={pattern.name}
                    onChange={(e) => updatePattern('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="My Cozy Sweater"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designer
                  </label>
                  <input
                    type="text"
                    value={pattern.designer}
                    onChange={(e) => updatePattern('designer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={pattern.difficulty}
                      onChange={(e) => updatePattern('difficulty', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={pattern.category}
                      onChange={(e) => updatePattern('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="sweater">Sweater</option>
                      <option value="cardigan">Cardigan</option>
                      <option value="scarf">Scarf</option>
                      <option value="hat">Hat</option>
                      <option value="socks">Socks</option>
                      <option value="shawl">Shawl</option>
                      <option value="blanket">Blanket</option>
                      <option value="toy">Toy/Amigurumi</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gauge
                  </label>
                  <input
                    type="text"
                    value={pattern.gauge}
                    onChange={(e) => updatePattern('gauge', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="20 sts x 28 rows = 4 inches"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Needle Size
                    </label>
                    <input
                      type="text"
                      value={pattern.needleSize}
                      onChange={(e) => updatePattern('needleSize', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="US 7 / 4.5mm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yarn Weight
                    </label>
                    <input
                      type="text"
                      value={pattern.yarnWeight}
                      onChange={(e) => updatePattern('yarnWeight', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Worsted"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yarn Required
                  </label>
                  <input
                    type="text"
                    value={pattern.yarnYardage}
                    onChange={(e) => updatePattern('yarnYardage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="800-1000 yards"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sizes
                  </label>
                  <input
                    type="text"
                    value={pattern.sizes}
                    onChange={(e) => updatePattern('sizes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="XS, S, M, L, XL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={pattern.notes}
                    onChange={(e) => updatePattern('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional pattern notes..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pattern Builder Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Section Tabs */}
              <div className="border-b border-gray-200 px-4 pt-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {pattern.sections.map((section, index) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(index)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg whitespace-nowrap ${
                        activeSection === index
                          ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <FiGrid className="w-4 h-4" />
                      <span className="text-sm font-medium">{section.name}</span>
                      {pattern.sections.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSection(index);
                          }}
                          className="ml-1 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={addSection}
                    className="flex items-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span className="text-sm">Add Section</span>
                  </button>
                </div>
              </div>

              {/* Section Content */}
              <div className="p-4">
                {currentSection && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section Name
                      </label>
                      <input
                        type="text"
                        value={currentSection.name}
                        onChange={(e) => updateSectionName(activeSection, e.target.value)}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* Rows */}
                    <div className="space-y-4">
                      {currentSection.rows.map((row, rowIndex) => (
                        <div
                          key={row.id}
                          className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-4">
                                <div className="w-20">
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Row #
                                  </label>
                                  <input
                                    type="number"
                                    value={row.rowNumber}
                                    onChange={(e) =>
                                      updateRow(
                                        activeSection,
                                        rowIndex,
                                        'rowNumber',
                                        parseInt(e.target.value) || 1
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    min="1"
                                  />
                                </div>
                                <div className="w-24">
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Stitch Count
                                  </label>
                                  <input
                                    type="number"
                                    value={row.stitchCount || ''}
                                    onChange={(e) =>
                                      updateRow(
                                        activeSection,
                                        rowIndex,
                                        'stitchCount',
                                        e.target.value ? parseInt(e.target.value) : undefined
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="sts"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  Instructions
                                </label>
                                <textarea
                                  value={row.instructions}
                                  onChange={(e) =>
                                    updateRow(activeSection, rowIndex, 'instructions', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  rows={2}
                                  placeholder="K2, *P2, K2* repeat to end"
                                />
                              </div>

                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  Notes (optional)
                                </label>
                                <input
                                  type="text"
                                  value={row.notes || ''}
                                  onChange={(e) =>
                                    updateRow(activeSection, rowIndex, 'notes', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder="Any special notes for this row"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => removeRow(activeSection, rowIndex)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => addRow(activeSection)}
                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 flex items-center justify-center gap-2"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Row
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
