// Canonical skill levels per Craft Yarn Council (CYC):
// https://www.craftyarncouncil.com/standards/project-levels
//
// Legacy values still appearing in the wild (Beginner / Advanced / Expert /
// Experienced) are normalized via normalizeSkillLevel before persistence.

export const SKILL_LEVELS = ['basic', 'easy', 'intermediate', 'complex'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

const LEGACY_TO_CANONICAL: Record<string, SkillLevel> = {
  basic: 'basic',
  beginner: 'basic',
  easy: 'easy',
  intermediate: 'intermediate',
  complex: 'complex',
  advanced: 'complex',
  experienced: 'complex',
  expert: 'complex',
};

export function normalizeSkillLevel(input: string | null | undefined): SkillLevel | null {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  return LEGACY_TO_CANONICAL[key] ?? null;
}

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  basic: 'Basic',
  easy: 'Easy',
  intermediate: 'Intermediate',
  complex: 'Complex',
};

export const SKILL_LEVEL_DESCRIPTIONS: Record<SkillLevel, string> = {
  basic: 'Projects for first-time knitters using basic stitches.',
  easy: 'Projects with basic stitches, repetitive patterns, simple color changes, and simple finishing.',
  intermediate: 'Projects with a variety of stitches, mid-level shaping, simple color or lace patterns.',
  complex: 'Projects with intricate stitch patterns, techniques and dimension, including refined shaping and finishing.',
};
