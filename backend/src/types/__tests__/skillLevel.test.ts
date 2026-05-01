import { normalizeSkillLevel, SKILL_LEVELS, SKILL_LEVEL_LABELS } from '../skillLevel';

describe('normalizeSkillLevel', () => {
  it('passes canonical values through', () => {
    for (const level of SKILL_LEVELS) {
      expect(normalizeSkillLevel(level)).toBe(level);
    }
  });

  it('maps legacy values to canonical', () => {
    expect(normalizeSkillLevel('beginner')).toBe('basic');
    expect(normalizeSkillLevel('advanced')).toBe('complex');
    expect(normalizeSkillLevel('expert')).toBe('complex');
    expect(normalizeSkillLevel('experienced')).toBe('complex');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeSkillLevel('  Beginner  ')).toBe('basic');
    expect(normalizeSkillLevel('EXPERT')).toBe('complex');
    expect(normalizeSkillLevel('Intermediate')).toBe('intermediate');
  });

  it('returns null for empty / unknown input', () => {
    expect(normalizeSkillLevel(null)).toBeNull();
    expect(normalizeSkillLevel(undefined)).toBeNull();
    expect(normalizeSkillLevel('')).toBeNull();
    expect(normalizeSkillLevel('wizard')).toBeNull();
  });
});

describe('SKILL_LEVEL_LABELS', () => {
  it('covers every canonical level', () => {
    for (const level of SKILL_LEVELS) {
      expect(SKILL_LEVEL_LABELS[level]).toBeTruthy();
    }
  });
});
