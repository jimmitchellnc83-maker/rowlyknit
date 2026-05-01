/**
 * CYC marketing-calendar hooks.
 *
 * The Craft Yarn Council promotes two recurring industry events that are
 * load-bearing in modern knitting marketing and worth surfacing in-app:
 *
 *   - **Stitch Away Stress** — every April. Hashtag #StitchAwayStress.
 *     CYC frames this around their wellness research (n=3,100, 85%
 *     stress-reduction reporting).
 *   - **I Love Yarn Day** — the **2nd Saturday of October**. Hashtag
 *     #iloveyarnday.
 *
 * Plus the year-round Warm Up America charity rail (7"×9" rectangles
 * for afghan donations) — handled as a built-in Designer template
 * rather than a date-bounded banner.
 *
 * Pure date math — no I/O, no React, no DOM. UI consumes via
 * `getActiveCycEvents(date)`.
 */

export type CycEventId = 'stitch-away-stress' | 'i-love-yarn-day';

export interface CycEvent {
  id: CycEventId;
  /** Marketing-name title, suitable for banner heading. */
  title: string;
  /** One-sentence description for tooltip / banner body. */
  description: string;
  /** Hashtag CYC promotes — caller surfaces it as a click-to-copy. */
  hashtag: string;
  /** Inclusive start date for the current year. */
  startDate: Date;
  /** Inclusive end date for the current year. */
  endDate: Date;
}

/**
 * Compute the date of "I Love Yarn Day" for a given year — the 2nd
 * Saturday of October.
 */
export function iLoveYarnDay(year: number): Date {
  // Oct 1 of the year. Find the first Saturday on/after that, then add 7.
  const oct1 = new Date(Date.UTC(year, 9, 1));
  const dayOfWeek = oct1.getUTCDay(); // 0 Sun … 6 Sat
  const daysUntilFirstSaturday = (6 - dayOfWeek + 7) % 7;
  const firstSaturday = new Date(oct1);
  firstSaturday.setUTCDate(oct1.getUTCDate() + daysUntilFirstSaturday);
  const secondSaturday = new Date(firstSaturday);
  secondSaturday.setUTCDate(firstSaturday.getUTCDate() + 7);
  return secondSaturday;
}

/**
 * Return the "Stitch Away Stress" date range for a given year — the
 * full month of April.
 */
function stitchAwayStressRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 3, 1)), // Apr 1
    end: new Date(Date.UTC(year, 3, 30, 23, 59, 59, 999)), // Apr 30 end-of-day
  };
}

/**
 * Return all CYC events that are active on the supplied date. Pass a
 * Date instance; defaults to "now" so callers writing
 * `getActiveCycEvents()` get current-year events.
 */
export function getActiveCycEvents(date: Date = new Date()): CycEvent[] {
  const year = date.getUTCFullYear();
  const events: CycEvent[] = [];

  const sas = stitchAwayStressRange(year);
  if (date >= sas.start && date <= sas.end) {
    events.push({
      id: 'stitch-away-stress',
      title: 'Stitch Away Stress',
      description:
        'CYC promotes April as a month to lean into knitting and crochet for stress relief. Their wellness survey (n=3,100) found 85% of crafters report reduced stress while making.',
      hashtag: '#StitchAwayStress',
      startDate: sas.start,
      endDate: sas.end,
    });
  }

  const ily = iLoveYarnDay(year);
  // Active for the day itself in UTC. Window: [ily, ily+1).
  const ilyEnd = new Date(ily);
  ilyEnd.setUTCDate(ily.getUTCDate() + 1);
  if (date >= ily && date < ilyEnd) {
    events.push({
      id: 'i-love-yarn-day',
      title: 'I Love Yarn Day',
      description:
        "CYC's annual industry holiday — second Saturday of October. Knitting and crochet shops, designers, and yarn brands worldwide post finished objects and works in progress.",
      hashtag: '#iloveyarnday',
      startDate: ily,
      endDate: ilyEnd,
    });
  }

  return events;
}

/**
 * Return the next upcoming CYC event from the supplied date. Useful
 * for "in N days" display surfaces. Skips events currently active
 * (since "next" implies forward-looking).
 */
export function getNextCycEvent(date: Date = new Date()): CycEvent | null {
  const year = date.getUTCFullYear();
  const candidates: CycEvent[] = [];

  for (const targetYear of [year, year + 1]) {
    const sas = stitchAwayStressRange(targetYear);
    if (sas.start > date) {
      candidates.push({
        id: 'stitch-away-stress',
        title: 'Stitch Away Stress',
        description:
          'CYC promotes April as a month to lean into knitting and crochet for stress relief.',
        hashtag: '#StitchAwayStress',
        startDate: sas.start,
        endDate: sas.end,
      });
    }
    const ily = iLoveYarnDay(targetYear);
    if (ily > date) {
      const ilyEnd = new Date(ily);
      ilyEnd.setUTCDate(ily.getUTCDate() + 1);
      candidates.push({
        id: 'i-love-yarn-day',
        title: 'I Love Yarn Day',
        description: "CYC's annual industry holiday — second Saturday of October.",
        hashtag: '#iloveyarnday',
        startDate: ily,
        endDate: ilyEnd,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return candidates[0];
}
