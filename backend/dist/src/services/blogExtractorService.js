"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const jsdom_1 = require("jsdom");
const readability_1 = require("@mozilla/readability");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class BlogExtractorService {
    constructor() {
        this.timeout = 30000; // 30 seconds
        this.maxContentLength = 5 * 1024 * 1024; // 5MB max
    }
    /**
     * Fetch and extract content from a URL
     */
    async extractFromUrl(userId, url) {
        const startTime = Date.now();
        let importRecord = null;
        try {
            // Validate URL
            const parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
            }
            // Create import record
            const [record] = await (0, database_1.default)('pattern_imports')
                .insert({
                user_id: userId,
                source_url: url,
                status: 'pending',
            })
                .returning('*');
            importRecord = record;
            // Fetch the page
            const response = await axios_1.default.get(url, {
                timeout: this.timeout,
                maxContentLength: this.maxContentLength,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; RowlyKnit/1.0; +https://rowlyknit.com)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                validateStatus: (status) => status >= 200 && status < 400,
            });
            const fetchTime = Date.now() - startTime;
            const rawContent = response.data;
            // Parse with JSDOM
            const dom = new jsdom_1.JSDOM(rawContent, {
                url: url,
            });
            // Extract with Readability
            const reader = new readability_1.Readability(dom.window.document);
            const article = reader.parse();
            if (!article) {
                throw new Error('Unable to extract readable content from this page.');
            }
            // Update import record with extracted content
            await (0, database_1.default)('pattern_imports')
                .where({ id: importRecord.id })
                .update({
                raw_content: rawContent.substring(0, 100000), // Store first 100KB for reference
                extracted_content: article.textContent,
                page_title: article.title,
                extraction_metadata: {
                    byline: article.byline,
                    siteName: article.siteName,
                    excerpt: article.excerpt,
                    length: article.length,
                    fetchTime,
                    contentLength: rawContent.length,
                },
                status: 'extracted',
                success: true,
                updated_at: new Date(),
            });
            logger_1.default.info('Blog content extracted successfully', {
                userId,
                url,
                importId: importRecord.id,
                title: article.title,
                contentLength: article.length,
            });
            return {
                success: true,
                importId: importRecord.id,
                sourceUrl: url,
                extracted: {
                    title: article.title,
                    content: article.content,
                    textContent: article.textContent,
                    excerpt: article.excerpt || '',
                    byline: article.byline,
                    siteName: article.siteName,
                    length: article.length,
                },
                metadata: {
                    fetchTime,
                    contentLength: rawContent.length,
                    statusCode: response.status,
                },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            // Update import record with error
            if (importRecord) {
                await (0, database_1.default)('pattern_imports')
                    .where({ id: importRecord.id })
                    .update({
                    status: 'failed',
                    success: false,
                    error_message: errorMessage,
                    updated_at: new Date(),
                });
            }
            logger_1.default.error('Failed to extract blog content', {
                userId,
                url,
                error: errorMessage,
                importId: importRecord?.id,
            });
            return {
                success: false,
                importId: importRecord?.id || '',
                sourceUrl: url,
                error: errorMessage,
            };
        }
    }
    /**
     * Parse extracted content to identify pattern sections
     */
    parsePatternContent(textContent) {
        const content = textContent.toLowerCase();
        const lines = textContent.split('\n').map(line => line.trim()).filter(Boolean);
        // Extract pattern name (usually first heading or title)
        const name = this.extractPatternName(lines);
        // Extract designer
        const designer = this.extractDesigner(textContent);
        // Extract difficulty
        const difficulty = this.extractDifficulty(content);
        // Extract category
        const category = this.extractCategory(content);
        // Extract yarn requirements
        const yarnRequirements = this.extractYarnRequirements(textContent);
        // Extract needle sizes
        const needleSizes = this.extractNeedleSizes(textContent);
        // Extract gauge
        const gauge = this.extractGauge(textContent);
        // Extract sizes
        const sizesAvailable = this.extractSizes(textContent);
        // Extract yardage
        const estimatedYardage = this.extractYardage(textContent);
        // Get main description (first substantial paragraph)
        const description = this.extractDescription(lines);
        // Notes will be the full cleaned content
        const notes = textContent.substring(0, 10000); // Limit to 10KB
        return {
            name,
            description,
            designer,
            difficulty,
            category,
            notes,
            yarnRequirements,
            needleSizes,
            gauge,
            sizesAvailable,
            estimatedYardage,
        };
    }
    extractPatternName(lines) {
        // Look for a line that looks like a title
        for (const line of lines.slice(0, 10)) {
            // Skip very short or very long lines
            if (line.length > 10 && line.length < 100) {
                // Skip lines that are clearly not titles
                if (!line.toLowerCase().includes('cookie') &&
                    !line.toLowerCase().includes('subscribe') &&
                    !line.toLowerCase().includes('menu')) {
                    return line;
                }
            }
        }
        return 'Imported Pattern';
    }
    extractDesigner(content) {
        const patterns = [
            /designed?\s+by[:\s]+([A-Za-z\s]+)/i,
            /pattern\s+by[:\s]+([A-Za-z\s]+)/i,
            /designer[:\s]+([A-Za-z\s]+)/i,
            /by[:\s]+([A-Za-z]+\s+[A-Za-z]+)(?:\s|,|$)/i,
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const designer = match[1].trim();
                // Validate it looks like a name
                if (designer.length > 3 && designer.length < 50) {
                    return designer;
                }
            }
        }
        return null;
    }
    extractDifficulty(content) {
        const difficulties = {
            'beginner': 'beginner',
            'easy': 'easy',
            'intermediate': 'intermediate',
            'advanced': 'advanced',
            'expert': 'expert',
            'experienced': 'advanced',
        };
        for (const [keyword, level] of Object.entries(difficulties)) {
            if (content.includes(`difficulty: ${keyword}`) ||
                content.includes(`level: ${keyword}`) ||
                content.includes(`skill level: ${keyword}`) ||
                content.includes(`(${keyword})`)) {
                return level;
            }
        }
        return null;
    }
    extractCategory(content) {
        const categories = [
            'sweater', 'cardigan', 'pullover', 'vest',
            'scarf', 'cowl', 'shawl', 'wrap',
            'hat', 'beanie', 'cap', 'beret',
            'socks', 'mittens', 'gloves',
            'blanket', 'throw', 'afghan',
            'bag', 'tote',
        ];
        for (const cat of categories) {
            if (content.includes(cat)) {
                // Map to standard categories
                if (['sweater', 'cardigan', 'pullover', 'vest'].includes(cat))
                    return 'sweater';
                if (['scarf', 'cowl', 'shawl', 'wrap'].includes(cat))
                    return 'scarf';
                if (['hat', 'beanie', 'cap', 'beret'].includes(cat))
                    return 'hat';
                if (['blanket', 'throw', 'afghan'].includes(cat))
                    return 'blanket';
                return cat;
            }
        }
        return null;
    }
    extractYarnRequirements(content) {
        const requirements = [];
        // Pattern for yarn weight
        const weightPatterns = [
            /(\d+)\s*(?:yd|yards?|m|meters?)\s+of\s+([\w\s]+)\s+(?:weight\s+)?yarn/gi,
            /(fingering|sport|dk|worsted|aran|bulky|super bulky)\s+(?:weight\s+)?yarn/gi,
        ];
        const weightMatch = content.match(weightPatterns[1]);
        if (weightMatch) {
            requirements.push({
                weight: weightMatch[1].toLowerCase(),
                yardage: null,
                fiber: null,
            });
        }
        // Try to find yardage
        const yardageMatch = content.match(/(\d+)\s*(?:-\s*\d+)?\s*(?:yd|yards?)/i);
        if (yardageMatch && requirements.length > 0) {
            requirements[0].yardage = parseInt(yardageMatch[1], 10);
        }
        return requirements;
    }
    extractNeedleSizes(content) {
        const sizes = [];
        // US sizes
        const usMatch = content.match(/US\s*(\d+(?:\.5)?)/gi);
        if (usMatch) {
            usMatch.forEach(match => {
                const sizeNum = match.match(/\d+(?:\.5)?/);
                if (sizeNum) {
                    sizes.push({ us: sizeNum[0] });
                }
            });
        }
        // Metric sizes
        const mmMatch = content.match(/(\d+(?:\.\d+)?)\s*mm/gi);
        if (mmMatch) {
            mmMatch.forEach(match => {
                const sizeNum = match.match(/\d+(?:\.\d+)?/);
                if (sizeNum) {
                    const existing = sizes.find(s => !s.mm);
                    if (existing) {
                        existing.mm = sizeNum[0];
                    }
                    else {
                        sizes.push({ mm: sizeNum[0] });
                    }
                }
            });
        }
        return sizes;
    }
    extractGauge(content) {
        // Look for gauge pattern like "20 stitches x 28 rows = 4 inches" or "20 sts / 28 rows in 4""
        const gaugePattern = /(\d+)\s*(?:st|sts|stitches?)\s*(?:x|and|\/|,)\s*(\d+)\s*(?:rows?|r)\s*(?:=|in|per|over)\s*4\s*(?:"|inches?|in)/i;
        const match = content.match(gaugePattern);
        if (match) {
            return {
                stitches: parseInt(match[1], 10),
                rows: parseInt(match[2], 10),
                measurement: '4 inches',
            };
        }
        // Simpler pattern
        const simplePattern = /(\d+)\s*(?:st|sts|stitches?)\s*(?:per|\/)\s*(?:4\s*)?(?:"|inch)/i;
        const simpleMatch = content.match(simplePattern);
        if (simpleMatch) {
            return {
                stitches: parseInt(simpleMatch[1], 10),
                rows: null,
                measurement: '4 inches',
            };
        }
        return null;
    }
    extractSizes(content) {
        const sizes = [];
        // Common size formats
        const sizePatterns = [
            /sizes?[:\s]*(XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)/gi,
            /sizes?[:\s]*(\d+"?\s*[-–]\s*\d+"?)/g,
        ];
        for (const pattern of sizePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach(m => {
                    const cleaned = m.replace(/sizes?[:\s]*/i, '').trim();
                    if (!sizes.includes(cleaned)) {
                        sizes.push(cleaned);
                    }
                });
            }
        }
        return sizes;
    }
    extractYardage(content) {
        const yardagePattern = /(?:total|approx(?:imately)?|about)?\s*(\d+)\s*(?:-\s*\d+)?\s*(?:yd|yards?)/i;
        const match = content.match(yardagePattern);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }
    extractDescription(lines) {
        // Find first substantial paragraph (more than 50 chars, not a list item)
        for (const line of lines) {
            if (line.length > 50 &&
                !line.startsWith('-') &&
                !line.startsWith('•') &&
                !line.match(/^\d+\./)) {
                return line.substring(0, 500);
            }
        }
        return '';
    }
    /**
     * Save extracted pattern to database
     */
    async savePattern(userId, importId, patternData, sourceUrl) {
        try {
            // Create the pattern
            const [pattern] = await (0, database_1.default)('patterns')
                .insert({
                user_id: userId,
                name: patternData.name || 'Imported Pattern',
                description: patternData.description || '',
                designer: patternData.designer,
                source: 'blog',
                source_url: sourceUrl,
                source_type: 'blog_import',
                difficulty: patternData.difficulty,
                category: patternData.category,
                notes: patternData.notes,
                yarn_requirements: JSON.stringify(patternData.yarnRequirements || []),
                needle_sizes: JSON.stringify(patternData.needleSizes || []),
                gauge: patternData.gauge ? JSON.stringify(patternData.gauge) : null,
                sizes_available: JSON.stringify(patternData.sizesAvailable || []),
                estimated_yardage: patternData.estimatedYardage,
                imported_at: new Date(),
            })
                .returning('*');
            // Update import record
            await (0, database_1.default)('pattern_imports')
                .where({ id: importId })
                .update({
                pattern_id: pattern.id,
                status: 'saved',
                updated_at: new Date(),
            });
            logger_1.default.info('Pattern saved from import', {
                userId,
                patternId: pattern.id,
                importId,
                name: pattern.name,
            });
            return pattern.id;
        }
        catch (error) {
            logger_1.default.error('Failed to save imported pattern', {
                userId,
                importId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Get import history for a user
     */
    async getImportHistory(userId, limit = 20) {
        return (0, database_1.default)('pattern_imports')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(limit);
    }
    /**
     * Get a specific import record
     */
    async getImport(importId, userId) {
        return (0, database_1.default)('pattern_imports')
            .where({ id: importId, user_id: userId })
            .first();
    }
}
exports.default = new BlogExtractorService();
