/**
 * Input sanitization utilities to prevent mass assignment vulnerabilities
 * and other security issues
 */

/**
 * Pick only allowed fields from an object
 */
export function pickFields<T extends Record<string, any>>(
  data: Record<string, any>,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: any = {};

  for (const field of allowedFields) {
    if (data[field as string] !== undefined) {
      result[field] = data[field as string];
    }
  }

  return result;
}

/**
 * Sanitize search query to prevent SQL injection
 * (Knex already handles this, but this provides explicit sanitization)
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }

  // Keep alphanumeric, spaces, hyphens, underscores, dots, slashes, apostrophes, hash
  // (knitters search for needle sizes like "US 10/6mm", colors like "#5", yarn names with apostrophes)
  return query.replace(/[^\w\s\-./#']/g, '').trim().slice(0, 200);
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return '';
  }

  // null-byte rejection is the point; suppress no-control-regex.
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[/\\:*?"<>|\x00]/g, '').replace(/\.\.+/g, '.').trim().slice(0, 255);
}

/**
 * Sanitize Content-Disposition header value
 */
export function sanitizeHeaderValue(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  // null-byte rejection prevents header injection; suppress no-control-regex.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\x00]/g, '').trim();
}

/**
 * Allowed fields for each entity type
 */
export const ALLOWED_FIELDS = {
  pattern: [
    'name',
    'description',
    'designer',
    'source',
    'sourceUrl',
    'difficulty',
    'category',
    'yarnRequirements',
    'needleSizes',
    'gauge',
    'sizesAvailable',
    'estimatedYardage',
    'notes',
    'tags',
    'isFavorite',
  ],
  project: [
    'name',
    'description',
    'projectType',
    'startDate',
    'targetCompletionDate',
    'completedDate',
    'status',
    'notes',
    'metadata',
    'tags',
  ],
  yarn: [
    'brand',
    'line',
    'name',
    'color',
    'colorCode',
    'weight',
    'fiberContent',
    'yardsTotal',
    'gramsTotal',
    'skeinsTotal',
    'pricePerSkein',
    'purchaseDate',
    'purchaseLocation',
    'dyeLot',
    'notes',
    'tags',
    'lowStockThreshold',
    'lowStockAlert',
  ],
  tool: [
    'name',
    'type',
    'size',
    'material',
    'brand',
    'purchaseDate',
    'purchaseLocation',
    'purchasePrice',
    'notes',
  ],
  note: [
    'title',
    'content',
    'noteType',
    'tags',
  ],
  counter: [
    'name',
    'currentValue',
    'targetValue',
    'step',
    'notes',
  ],
  recipient: [
    'name',
    'relationship',
    'measurements',
    'preferences',
    'notes',
  ],
  session: [
    'duration',
    'rowsCompleted',
    'notes',
  ],
};
