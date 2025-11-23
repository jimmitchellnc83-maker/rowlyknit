"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pdf_lib_1 = require("pdf-lib");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class PatternExportService {
    /**
     * Calculate adjusted yarn yardage based on size modifications
     * Formula: adjusted_yards = base_yards * (1 + (length_adjustment + width_adjustment) / 100)
     */
    calculateYarnRequirements(baseYardage, lengthAdjustmentPercent = 0, widthAdjustmentPercent = 0) {
        const totalAdjustment = lengthAdjustmentPercent + widthAdjustmentPercent;
        const multiplier = 1 + totalAdjustment / 100;
        const adjustedYardage = Math.ceil(baseYardage * multiplier);
        return {
            baseYardage,
            adjustedYardage,
            percentageIncrease: totalAdjustment,
        };
    }
    /**
     * Convert length adjustment to percentage based on average pattern dimensions
     */
    lengthToPercentage(lengthChange, unit = 'inches') {
        // Average sweater body length is about 25 inches
        const averageLength = unit === 'cm' ? 63.5 : 25;
        return (lengthChange / averageLength) * 100;
    }
    /**
     * Convert width adjustment to percentage based on average pattern dimensions
     */
    widthToPercentage(widthChange, unit = 'inches') {
        // Average sweater chest is about 40 inches
        const averageWidth = unit === 'cm' ? 101.6 : 40;
        return (widthChange / averageWidth) * 100;
    }
    /**
     * Generate a professional PDF export with yarn requirements
     */
    async generateExportPDF(userId, patternId, projectId, options) {
        try {
            // Fetch pattern data
            const pattern = await (0, database_1.default)('patterns')
                .where({ id: patternId, user_id: userId })
                .whereNull('deleted_at')
                .first();
            if (!pattern) {
                return { success: false, error: 'Pattern not found' };
            }
            // Parse JSONB fields
            const patternData = {
                ...pattern,
                yarn_requirements: pattern.yarn_requirements
                    ? (typeof pattern.yarn_requirements === 'string'
                        ? JSON.parse(pattern.yarn_requirements)
                        : pattern.yarn_requirements)
                    : [],
                needle_sizes: pattern.needle_sizes
                    ? (typeof pattern.needle_sizes === 'string'
                        ? JSON.parse(pattern.needle_sizes)
                        : pattern.needle_sizes)
                    : [],
                gauge: pattern.gauge
                    ? (typeof pattern.gauge === 'string' ? JSON.parse(pattern.gauge) : pattern.gauge)
                    : null,
                sizes_available: pattern.sizes_available
                    ? (typeof pattern.sizes_available === 'string'
                        ? JSON.parse(pattern.sizes_available)
                        : pattern.sizes_available)
                    : [],
            };
            // Fetch project data if provided
            let projectData = null;
            if (projectId) {
                const project = await (0, database_1.default)('projects')
                    .where({ id: projectId, user_id: userId })
                    .whereNull('deleted_at')
                    .first();
                if (project) {
                    projectData = {
                        id: project.id,
                        name: project.name,
                        selected_size: project.selected_size,
                        size_adjustments: project.size_adjustments
                            ? (typeof project.size_adjustments === 'string'
                                ? JSON.parse(project.size_adjustments)
                                : project.size_adjustments)
                            : undefined,
                    };
                }
            }
            // Create PDF document
            const pdfDoc = await pdf_lib_1.PDFDocument.create();
            const timesRoman = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.TimesRoman);
            const timesRomanBold = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.TimesRomanBold);
            const helvetica = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
            const helveticaBold = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
            // Create first page
            let page = pdfDoc.addPage([612, 792]); // Letter size
            let yPosition = 750;
            const leftMargin = 50;
            const rightMargin = 562;
            const lineHeight = 16;
            // Helper function to add text
            const addText = (text, font, size, color = (0, pdf_lib_1.rgb)(0, 0, 0), indent = 0) => {
                if (yPosition < 60) {
                    page = pdfDoc.addPage([612, 792]);
                    yPosition = 750;
                }
                page.drawText(text, {
                    x: leftMargin + indent,
                    y: yPosition,
                    size,
                    font,
                    color,
                });
                yPosition -= lineHeight;
            };
            // Helper to add a horizontal line
            const addLine = () => {
                if (yPosition < 60) {
                    page = pdfDoc.addPage([612, 792]);
                    yPosition = 750;
                }
                page.drawLine({
                    start: { x: leftMargin, y: yPosition + 8 },
                    end: { x: rightMargin, y: yPosition + 8 },
                    thickness: 1,
                    color: (0, pdf_lib_1.rgb)(0.8, 0.8, 0.8),
                });
                yPosition -= 8;
            };
            // Title
            addText(patternData.name, timesRomanBold, 24, (0, pdf_lib_1.rgb)(0.1, 0.1, 0.3));
            yPosition -= 8;
            // Designer
            if (patternData.designer) {
                addText(`by ${patternData.designer}`, timesRoman, 14, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4));
            }
            yPosition -= 10;
            addLine();
            yPosition -= 10;
            // Pattern Info Section
            addText('Pattern Information', helveticaBold, 14, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.5));
            yPosition -= 4;
            if (patternData.category) {
                addText(`Category: ${patternData.category}`, helvetica, 11, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3), 10);
            }
            if (patternData.difficulty) {
                addText(`Difficulty: ${patternData.difficulty}`, helvetica, 11, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3), 10);
            }
            if (patternData.source_url) {
                addText(`Source: ${patternData.source_url}`, helvetica, 10, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.6), 10);
            }
            // Selected Size
            const selectedSize = options.selectedSize || projectData?.selected_size;
            if (selectedSize) {
                addText(`Selected Size: ${selectedSize}`, helvetica, 11, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3), 10);
            }
            yPosition -= 10;
            // Gauge Section
            if (options.includeGauge && patternData.gauge) {
                addLine();
                yPosition -= 10;
                addText('Gauge', helveticaBold, 14, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.5));
                yPosition -= 4;
                let gaugeText = '';
                if (patternData.gauge.stitches) {
                    gaugeText += `${patternData.gauge.stitches} stitches`;
                }
                if (patternData.gauge.rows) {
                    gaugeText += ` x ${patternData.gauge.rows} rows`;
                }
                if (patternData.gauge.measurement) {
                    gaugeText += ` = ${patternData.gauge.measurement}`;
                }
                if (gaugeText) {
                    addText(gaugeText, helvetica, 11, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3), 10);
                }
                yPosition -= 10;
            }
            // Needle Sizes Section
            if (patternData.needle_sizes && patternData.needle_sizes.length > 0) {
                addLine();
                yPosition -= 10;
                addText('Needle Sizes', helveticaBold, 14, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.5));
                yPosition -= 4;
                patternData.needle_sizes.forEach((needle) => {
                    let needleText = '';
                    if (needle.us)
                        needleText += `US ${needle.us}`;
                    if (needle.mm)
                        needleText += ` (${needle.mm}mm)`;
                    if (needle.type)
                        needleText += ` - ${needle.type}`;
                    if (needleText) {
                        addText(`• ${needleText}`, helvetica, 11, (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3), 10);
                    }
                });
                yPosition -= 10;
            }
            // Yarn Requirements Section (main feature)
            if (options.includeYarnRequirements) {
                addLine();
                yPosition -= 10;
                addText('Yarn Requirements', helveticaBold, 14, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.5));
                yPosition -= 4;
                // Calculate adjustments
                let lengthAdjustmentPercent = 0;
                let widthAdjustmentPercent = 0;
                if (options.includeSizeAdjustments) {
                    const lengthAdj = options.lengthAdjustment || projectData?.size_adjustments?.length || 0;
                    const widthAdj = options.widthAdjustment || projectData?.size_adjustments?.width || 0;
                    const unit = options.adjustmentUnit || projectData?.size_adjustments?.unit || 'inches';
                    lengthAdjustmentPercent = this.lengthToPercentage(lengthAdj, unit);
                    widthAdjustmentPercent = this.widthToPercentage(widthAdj, unit);
                }
                // Display yarn requirements with calculations
                if (patternData.yarn_requirements && patternData.yarn_requirements.length > 0) {
                    patternData.yarn_requirements.forEach((yarn, index) => {
                        const yarnName = yarn.name || yarn.weight || `Yarn ${index + 1}`;
                        const baseYardage = yarn.yardage || patternData.estimated_yardage || 0;
                        addText(`${yarnName}:`, helveticaBold, 11, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.2), 10);
                        if (yarn.weight) {
                            addText(`  Weight: ${yarn.weight}`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                        }
                        if (yarn.fiber) {
                            addText(`  Fiber: ${yarn.fiber}`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                        }
                        if (yarn.color) {
                            addText(`  Color: ${yarn.color}`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                        }
                        if (baseYardage > 0) {
                            const calculation = this.calculateYarnRequirements(baseYardage, lengthAdjustmentPercent, widthAdjustmentPercent);
                            if (calculation.percentageIncrease !== 0) {
                                addText(`  Base Yardage: ${calculation.baseYardage} yards`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                                addText(`  Size Adjustment: ${calculation.percentageIncrease > 0 ? '+' : ''}${calculation.percentageIncrease.toFixed(1)}%`, helvetica, 10, (0, pdf_lib_1.rgb)(0.6, 0.4, 0.2), 20);
                                addText(`  Adjusted Yardage: ${calculation.adjustedYardage} yards`, helveticaBold, 11, (0, pdf_lib_1.rgb)(0.1, 0.5, 0.1), 20);
                            }
                            else {
                                addText(`  Yardage: ${baseYardage} yards`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                            }
                        }
                        yPosition -= 4;
                    });
                }
                else if (patternData.estimated_yardage) {
                    // Use estimated yardage if no detailed requirements
                    const calculation = this.calculateYarnRequirements(patternData.estimated_yardage, lengthAdjustmentPercent, widthAdjustmentPercent);
                    addText('Estimated Yarn:', helveticaBold, 11, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.2), 10);
                    if (calculation.percentageIncrease !== 0) {
                        addText(`  Base Yardage: ${calculation.baseYardage} yards`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                        addText(`  Size Adjustment: ${calculation.percentageIncrease > 0 ? '+' : ''}${calculation.percentageIncrease.toFixed(1)}%`, helvetica, 10, (0, pdf_lib_1.rgb)(0.6, 0.4, 0.2), 20);
                        addText(`  Adjusted Yardage: ${calculation.adjustedYardage} yards`, helveticaBold, 11, (0, pdf_lib_1.rgb)(0.1, 0.5, 0.1), 20);
                    }
                    else {
                        addText(`  Estimated: ${patternData.estimated_yardage} yards`, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 20);
                    }
                }
                // Add adjustment explanation if adjustments were made
                if (options.includeSizeAdjustments && (lengthAdjustmentPercent !== 0 || widthAdjustmentPercent !== 0)) {
                    yPosition -= 8;
                    addText('* Yarn adjustments calculated based on your size modifications', helvetica, 9, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5), 10);
                }
                yPosition -= 10;
            }
            // Notes Section
            if (options.includeNotes && patternData.notes) {
                addLine();
                yPosition -= 10;
                addText('Notes', helveticaBold, 14, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.5));
                yPosition -= 4;
                // Wrap long notes
                const noteLines = this.wrapText(patternData.notes, 80);
                noteLines.slice(0, 20).forEach((line) => {
                    addText(line, helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 10);
                });
                if (noteLines.length > 20) {
                    addText('...', helvetica, 10, (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), 10);
                }
                yPosition -= 10;
            }
            // Footer
            yPosition = 40;
            page.drawText(`Generated by RowlyKnit on ${new Date().toLocaleDateString()}`, {
                x: leftMargin,
                y: yPosition,
                size: 9,
                font: helvetica,
                color: (0, pdf_lib_1.rgb)(0.6, 0.6, 0.6),
            });
            // Save PDF
            const pdfBytes = await pdfDoc.save();
            const uploadDir = process.env.UPLOAD_DIR || path_1.default.join(__dirname, '../../uploads');
            const exportsDir = path_1.default.join(uploadDir, 'exports');
            if (!fs_1.default.existsSync(exportsDir)) {
                fs_1.default.mkdirSync(exportsDir, { recursive: true });
            }
            const timestamp = Date.now();
            const safePatternName = patternData.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const filename = `${safePatternName}_${timestamp}.pdf`;
            const filePath = path_1.default.join(exportsDir, filename);
            fs_1.default.writeFileSync(filePath, pdfBytes);
            logger_1.default.info('Pattern exported to PDF', {
                userId,
                patternId,
                projectId,
                filename,
                fileSize: pdfBytes.byteLength,
            });
            return {
                success: true,
                filePath: `exports/${filename}`,
                fileUrl: `/uploads/exports/${filename}`,
                fileSize: pdfBytes.byteLength,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger_1.default.error('Error generating pattern export PDF', {
                userId,
                patternId,
                projectId,
                error: message,
            });
            return {
                success: false,
                error: message,
            };
        }
    }
    /**
     * Wrap text to fit within a specified character width
     */
    wrapText(text, maxChars) {
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';
        words.forEach((word) => {
            if ((currentLine + ' ' + word).trim().length <= maxChars) {
                currentLine = (currentLine + ' ' + word).trim();
            }
            else {
                if (currentLine)
                    lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine)
            lines.push(currentLine);
        return lines;
    }
}
exports.default = new PatternExportService();
