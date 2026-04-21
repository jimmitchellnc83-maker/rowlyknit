const key = (projectId: string) => `rowly:knittingMode:${projectId}`;

export function readKnittingMode(projectId: string): boolean {
  return localStorage.getItem(key(projectId)) === 'true';
}

export function writeKnittingMode(projectId: string, value: boolean): void {
  localStorage.setItem(key(projectId), String(value));
}
