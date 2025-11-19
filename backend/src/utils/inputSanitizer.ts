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

  // Remove potentially dangerous characters
  // Keep alphanumeric, spaces, hyphens, underscores
  return query.replace(/[^\w\s\-]/g, '').trim().slice(0, 200);
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return '';
  }

  // Remove path separators and null bytes
  return filename
    .replace(/[\/\\:*?"<>|\x00]/g, '')
    .replace(/\.\.+/g, '.')
    .trim()
    .slice(0, 255);
}

/**
 * Sanitize Content-Disposition header value
 */
export function sanitizeHeaderValue(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  // Remove newlines and other control characters that could enable header injection
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
    'name',
    'weight',
    'fiber',
    'colorName',
    'colorCode',
    'yardage',
    'gramsPerSkein',
    'purchaseDate',
    'purchaseLocation',
    'purchasePrice',
    'quantity',
    'notes',
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
