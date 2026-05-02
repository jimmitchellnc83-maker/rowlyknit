/**
 * API client for the Wave 2 source-files surface.
 *
 * Mirrors `backend/src/types/sourceFile.ts`; the two halves stay
 * structurally identical so the contract is just JSON.stringify away.
 *
 * Cross-craft: every call surfaces `craft` end-to-end. The list helper
 * accepts a `craft` filter; the upload helper requires the caller to
 * pick one (defaults to `'knit'` to match current population, but
 * crochet flows pass `'crochet'` explicitly).
 */

import axios from 'axios';

export type Craft = 'knit' | 'crochet';
export type SourceFileKind = 'pattern_pdf' | 'chart_image' | 'reference_doc';
export type SourceFileParseStatus = 'pending' | 'parsed' | 'failed' | 'skipped';

export interface PageDimension {
  w: number;
  h: number;
  unit: 'pt' | 'in' | 'cm';
}

export interface SourceFile {
  id: string;
  userId: string;
  craft: Craft;
  kind: SourceFileKind;
  storageFilename: string;
  storageSubdir: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  pageCount: number | null;
  pageDimensions: PageDimension[] | null;
  parseStatus: SourceFileParseStatus;
  parseError: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PatternCrop {
  id: string;
  sourceFileId: string;
  userId: string;
  patternId: string | null;
  patternSectionId: string | null;
  pageNumber: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  label: string | null;
  chartId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UploadSourceFileInput {
  file: File;
  craft?: Craft;
  kind?: SourceFileKind;
  projectId?: string;
  patternId?: string;
}

export async function uploadSourceFile(
  input: UploadSourceFileInput
): Promise<SourceFile> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.craft) form.append('craft', input.craft);
  if (input.kind) form.append('kind', input.kind);
  if (input.projectId) form.append('projectId', input.projectId);
  if (input.patternId) form.append('patternId', input.patternId);
  const res = await axios.post('/api/source-files', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.sourceFile as SourceFile;
}

export async function listSourceFiles(filters?: {
  craft?: Craft;
  kind?: SourceFileKind;
}): Promise<SourceFile[]> {
  const res = await axios.get('/api/source-files', { params: filters });
  return res.data.data.sourceFiles as SourceFile[];
}

export async function getSourceFile(id: string): Promise<SourceFile> {
  const res = await axios.get(`/api/source-files/${id}`);
  return res.data.data.sourceFile as SourceFile;
}

export function sourceFileBytesUrl(id: string): string {
  return `/api/source-files/${id}/file`;
}

export async function deleteSourceFile(id: string): Promise<void> {
  await axios.delete(`/api/source-files/${id}`);
}

export interface CreateCropInput {
  pageNumber: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  label?: string | null;
  patternId?: string | null;
  patternSectionId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createCrop(
  sourceFileId: string,
  input: CreateCropInput
): Promise<PatternCrop> {
  const res = await axios.post(
    `/api/source-files/${sourceFileId}/crops`,
    input
  );
  return res.data.data.crop as PatternCrop;
}

export async function listCropsForSourceFile(
  sourceFileId: string
): Promise<PatternCrop[]> {
  const res = await axios.get(`/api/source-files/${sourceFileId}/crops`);
  return res.data.data.crops as PatternCrop[];
}

export async function listCropsForPattern(
  patternId: string
): Promise<PatternCrop[]> {
  const res = await axios.get(`/api/patterns/${patternId}/crops`);
  return res.data.data.crops as PatternCrop[];
}

export interface UpdateCropInput {
  label?: string | null;
  chartId?: string | null;
  metadata?: Record<string, unknown>;
  pageNumber?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export async function updateCrop(
  sourceFileId: string,
  cropId: string,
  input: UpdateCropInput
): Promise<PatternCrop> {
  const res = await axios.patch(
    `/api/source-files/${sourceFileId}/crops/${cropId}`,
    input
  );
  return res.data.data.crop as PatternCrop;
}

export async function deleteCrop(
  sourceFileId: string,
  cropId: string
): Promise<void> {
  await axios.delete(`/api/source-files/${sourceFileId}/crops/${cropId}`);
}

export async function pinSourceFileToProjectPattern(args: {
  projectId: string;
  patternId: string;
  sourceFileId: string | null;
}): Promise<void> {
  await axios.patch(
    `/api/projects/${args.projectId}/patterns/${args.patternId}/source-file`,
    { sourceFileId: args.sourceFileId }
  );
}
