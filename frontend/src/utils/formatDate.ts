/**
 * Render a date string in the user's locale, falling back to a friendly
 * placeholder when the value is missing or empty. Many pages used to
 * inline `new Date(...).toLocaleDateString()` with their own null-check;
 * pulling the pattern out here keeps the surface uniform.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleDateString();
}
