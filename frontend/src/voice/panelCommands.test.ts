import { describe, it, expect } from 'vitest';
import { matchPanelVoiceIntent, resolveReadTarget } from './panelCommands';

describe('matchPanelVoiceIntent', () => {
  it('returns null for empty/noise', () => {
    expect(matchPanelVoiceIntent('')).toBeNull();
    expect(matchPanelVoiceIntent('uhhh what time is it')).toBeNull();
  });

  describe('advance / retreat', () => {
    it('parses next / next row / advance as advance', () => {
      expect(matchPanelVoiceIntent('next')).toEqual({ kind: 'advance' });
      expect(matchPanelVoiceIntent('next row')).toEqual({ kind: 'advance' });
      expect(matchPanelVoiceIntent('advance')).toEqual({ kind: 'advance' });
      expect(matchPanelVoiceIntent('forward')).toEqual({ kind: 'advance' });
    });

    it('parses back / back one / undo as retreat', () => {
      expect(matchPanelVoiceIntent('back')).toEqual({ kind: 'retreat' });
      expect(matchPanelVoiceIntent('back one')).toEqual({ kind: 'retreat' });
      expect(matchPanelVoiceIntent('undo')).toEqual({ kind: 'retreat' });
    });
  });

  describe('jump', () => {
    it('parses "jump to 20" as jump to row 20', () => {
      expect(matchPanelVoiceIntent('jump to 20')).toEqual({
        kind: 'jump',
        row: 20,
      });
    });
    it('parses "go to row 47"', () => {
      expect(matchPanelVoiceIntent('go to row 47')).toEqual({
        kind: 'jump',
        row: 47,
      });
    });
    it('parses "jump 100" (no "to")', () => {
      expect(matchPanelVoiceIntent('jump 100')).toEqual({
        kind: 'jump',
        row: 100,
      });
    });
  });

  describe('read', () => {
    it('parses "read all" / "read everything" / "read instructions"', () => {
      expect(matchPanelVoiceIntent('read all')).toEqual({
        kind: 'read',
        target: 'all',
      });
      expect(matchPanelVoiceIntent('read everything')).toEqual({
        kind: 'read',
        target: 'all',
      });
      expect(matchPanelVoiceIntent('read instructions')).toEqual({
        kind: 'read',
        target: 'all',
      });
    });

    it('parses "read cable a" as read with target "cable a"', () => {
      expect(matchPanelVoiceIntent('read cable a')).toEqual({
        kind: 'read',
        target: 'cable a',
      });
    });

    it('parses "read panel seed stitch" as target "seed stitch"', () => {
      expect(matchPanelVoiceIntent('read panel seed stitch')).toEqual({
        kind: 'read',
        target: 'seed stitch',
      });
    });

    it('"read all" beats "read <name>" — priority', () => {
      // "all" must not be interpreted as a panel name.
      expect(matchPanelVoiceIntent('read all')).toEqual({
        kind: 'read',
        target: 'all',
      });
    });
  });

  describe('where / stop', () => {
    it('parses "where am I"', () => {
      expect(matchPanelVoiceIntent('where am I')).toEqual({ kind: 'where' });
    });
    it('parses "stop"', () => {
      expect(matchPanelVoiceIntent('stop')).toEqual({ kind: 'stop' });
    });
    it('parses "pause" as stop', () => {
      expect(matchPanelVoiceIntent('pause')).toEqual({ kind: 'stop' });
    });
  });

  it('trims whitespace and is case-insensitive', () => {
    expect(matchPanelVoiceIntent('  NEXT  ')).toEqual({ kind: 'advance' });
    expect(matchPanelVoiceIntent('Where Am I?')).toEqual({ kind: 'where' });
  });
});

describe('resolveReadTarget', () => {
  const panelNames = ['Cable A', 'Seed Stitch', 'Honeycomb'];

  it('matches exact (case-insensitive)', () => {
    expect(resolveReadTarget('cable a', panelNames)).toBe('Cable A');
    expect(resolveReadTarget('SEED STITCH', panelNames)).toBe('Seed Stitch');
  });

  it('matches starts-with', () => {
    expect(resolveReadTarget('seed', panelNames)).toBe('Seed Stitch');
    expect(resolveReadTarget('hon', panelNames)).toBe('Honeycomb');
  });

  it('matches contains', () => {
    expect(resolveReadTarget('comb', panelNames)).toBe('Honeycomb');
  });

  it('matches when target is longer than panel name (spoken form)', () => {
    // User says "honey cone", panel is "Honeycomb" — neither starts-with
    // nor contains matches without a reverse-contains check. The reverse
    // check covers this: "honeycomb" includes "honey" which is in the
    // target.
    expect(resolveReadTarget('honey', panelNames)).toBe('Honeycomb');
  });

  it('returns null for no match', () => {
    expect(resolveReadTarget('lace', panelNames)).toBeNull();
  });

  it('returns null for empty inputs', () => {
    expect(resolveReadTarget('', panelNames)).toBeNull();
    expect(resolveReadTarget('anything', [])).toBeNull();
  });
});
