// Canonical skill levels per Craft Yarn Council (CYC):
// https://www.craftyarncouncil.com/standards/project-levels
//
// Legacy values still appearing in the wild (Beginner / Advanced / Expert /
// Experienced) are normalized via normalizeSkillLevel.

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
  easy: 'Basic stitches, repetitive patterns, simple color changes, simple finishing.',
  intermediate: 'Variety of stitches, mid-level shaping, simple color or lace patterns.',
  complex: 'Intricate stitch patterns, techniques and dimension, refined shaping and finishing.',
};

// Tailwind badge classes per skill level (light + dark mode).
export const SKILL_LEVEL_BADGE_CLASSES: Record<SkillLevel, string> = {
  basic: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  complex: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

// Best-effort lookup by raw stored value (handles legacy + canonical).
export function skillLevelLabel(value: string | null | undefined): string {
  const canonical = normalizeSkillLevel(value);
  if (!canonical) return value ?? '';
  return SKILL_LEVEL_LABELS[canonical];
}

export function skillLevelBadgeClasses(value: string | null | undefined): string {
  const canonical = normalizeSkillLevel(value);
  if (!canonical) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  return SKILL_LEVEL_BADGE_CLASSES[canonical];
}
