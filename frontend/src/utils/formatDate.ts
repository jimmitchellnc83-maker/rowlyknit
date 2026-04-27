/**
 * Render a date in the user's locale, falling back to a friendly placeholder
 * when the value is missing or invalid. Many pages used to inline
 * `new Date(...).toLocaleDateString()` with their own null-check; pulling the
 * pattern out here keeps the surface uniform.
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = 'Not set',
  locales?: string | string[],
): string {
  if (date == null || date === '') return fallback;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(locales, options);
}
