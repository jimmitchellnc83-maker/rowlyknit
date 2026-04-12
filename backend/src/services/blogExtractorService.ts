import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import db from '../config/database';
import logger from '../config/logger';

export interface ExtractedContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  length: number;
}

export interface ExtractionResult {
  success: boolean;
  importId: string;
  extracted?: ExtractedContent;
  sourceUrl: string;
  error?: string;
  metadata?: {
    fetchTime: number;
    contentLength: number;
    statusCode: number;
  };
}

export interface ParsedPatternData {
  name: string;
  description: string;
  designer: string | null;
  difficulty: string | null;
  category: string | null;
  notes: string;
  yarnRequirements: any[];
  needleSizes: any[];
  gauge: any | null;
  sizesAvailable: string[];
  estimatedYardage: number | null;
}

class BlogExtractorService {
  private readonly timeout = 30000; // 30 seconds
  private readonly maxContentLength = 5 * 1024 * 1024; // 5MB max

  /**
   * Fetch and extract content from a URL
   */
  async extractFromUrl(userId: string, url: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    let importRecord: any = null;

    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
      }

      // Create import record
      const [record] = await db('pattern_imports')
        .insert({
          user_id: userId,
          source_url: url,
          status: 'pending',
        })
        .returning('*');
      importRecord = record;

      // Fetch the page
      const response = await axios.get(url, {
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
      const dom = new JSDOM(rawContent, {
        url: url,
      });

      // Extract with Readability
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        throw new Error('Unable to extract readable content from this page.');
      }

      // Update import record with extracted content
      await db('pattern_imports')
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

      logger.info('Blog content extracted successfully', {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Update import record with error
      if (importRecord) {
        await db('pattern_imports')
          .where({ id: importRecord.id })
          .update({
            status: 'failed',
            success: false,
            error_message: errorMessage,
            updated_at: new Date(),
          });
      }

      logger.error('Failed to extract blog content', {
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
  parsePatternContent(textContent: string): ParsedPatternData {
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

  private extractPatternName(lines: string[]): string {
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

  private extractDesigner(content: string): string | null {
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

  private extractDifficulty(content: string): string | null {
    const difficulties: Record<string, string> = {
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

  private extractCategory(content: string): string | null {
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
        if (['sweater', 'cardigan', 'pullover', 'vest'].includes(cat)) return 'sweater';
        if (['scarf', 'cowl', 'shawl', 'wrap'].includes(cat)) return 'scarf';
        if (['hat', 'beanie', 'cap', 'beret'].includes(cat)) return 'hat';
        if (['blanket', 'throw', 'afghan'].includes(cat)) return 'blanket';
        return cat;
      }
    }
    return null;
  }

  private extractYarnRequirements(content: string): any[] {
    const requirements: any[] = [];

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

  private extractNeedleSizes(content: string): any[] {
    const sizes: any[] = [];

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
          } else {
            sizes.push({ mm: sizeNum[0] });
          }
        }
      });
    }

    return sizes;
  }

  private extractGauge(content: string): any | null {
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

  private extractSizes(content: string): string[] {
    const sizes: string[] = [];

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

  private extractYardage(content: string): number | null {
    const yardagePattern = /(?:total|approx(?:imately)?|about)?\s*(\d+)\s*(?:-\s*\d+)?\s*(?:yd|yards?)/i;
    const match = content.match(yardagePattern);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private extractDescription(lines: string[]): string {
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
  async savePattern(
    userId: string,
    importId: string,
    patternData: Partial<ParsedPatternData>,
    sourceUrl: string
  ): Promise<string> {
    try {
      // Create the pattern
      const [pattern] = await db('patterns')
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
      await db('pattern_imports')
        .where({ id: importId })
        .update({
          pattern_id: pattern.id,
          status: 'saved',
          updated_at: new Date(),
        });

      logger.info('Pattern saved from import', {
        userId,
        patternId: pattern.id,
        importId,
        name: pattern.name,
      });

      return pattern.id;
    } catch (error) {
      logger.error('Failed to save imported pattern', {
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
  async getImportHistory(userId: string, limit = 20): Promise<any[]> {
    return db('pattern_imports')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * Get a specific import record
   */
  async getImport(importId: string, userId: string): Promise<any | null> {
    return db('pattern_imports')
      .where({ id: importId, user_id: userId })
      .first();
  }
}

export default new BlogExtractorService();
