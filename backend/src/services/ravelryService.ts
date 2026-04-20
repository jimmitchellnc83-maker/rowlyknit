import axios, { AxiosInstance } from 'axios';
import sanitizeHtml from 'sanitize-html';
import logger from '../config/logger';
import ravelryOAuthService from './ravelryOAuthService';
import { ravelryThrottle } from './ravelryThrottle';

/** Strip all HTML tags and decode entities for plain-text storage */
function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Map a Ravelry yarn object (from search or detail endpoint) to our normalized shape.
 * Both endpoints sometimes use different field names — we handle both here.
 */
function mapYarnFields(y: any, isDetail: boolean = false) {
  // Fiber content: yarn_fibers (detail) or fiber_content (some search responses)
  let fiberContent: string | null = null;
  const fibers = y.yarn_fibers || y.fiber_content;
  if (Array.isArray(fibers) && fibers.length > 0) {
    fiberContent = fibers
      .map((f: any) => {
        const name = f.fiber_type?.name || f.name;
        const pct = f.percentage;
        return pct ? `${pct}% ${name}` : name;
      })
      .filter(Boolean)
      .join(', ');
  }

  // Brand: yarn_company.name (detail) or yarn_company_name (search)
  const brand = y.yarn_company?.name || y.yarn_company_name || null;

  // Gauge: gauge_description, or built from min/max gauge
  let gauge: string | null = null;
  if (y.gauge_description) {
    gauge = y.gauge_description;
  } else if (y.min_gauge || y.max_gauge) {
    const divisor = y.gauge_divisor || 4;
    const unit = divisor === 1 ? 'inch' : 'inches';
    if (y.min_gauge && y.max_gauge && y.min_gauge !== y.max_gauge) {
      gauge = `${y.min_gauge}–${y.max_gauge} sts over ${divisor} ${unit}`;
    } else {
      gauge = `${y.min_gauge || y.max_gauge} sts over ${divisor} ${unit}`;
    }
  }

  // Needle sizes: build a range from min/max
  let needleSizes: string | null = null;
  if (y.min_needle_size || y.max_needle_size) {
    const formatNeedle = (n: any): string => {
      if (!n) return '';
      const us = n.us ? `US ${n.us}` : '';
      const metric = n.metric ? `${n.metric} mm` : '';
      return [us, metric].filter(Boolean).join(' / ');
    };
    const min = formatNeedle(y.min_needle_size);
    const max = formatNeedle(y.max_needle_size);
    needleSizes = min && max && min !== max ? `${min} – ${max}` : min || max;
  }

  // Description: notes_html (preferred) or notes, with HTML stripped
  let description: string | null = null;
  if (isDetail) {
    if (y.notes_html) {
      description = stripHtml(String(y.notes_html));
    } else if (y.notes) {
      description = String(y.notes).trim();
    }
  }

  // Photo URL
  const photoUrl =
    y.photos?.[0]?.medium_url ||
    y.photos?.[0]?.small_url ||
    y.first_photo?.medium_url ||
    y.first_photo?.small_url ||
    null;

  return {
    id: y.id,
    name: y.name,
    brand,
    weight: y.yarn_weight?.name || null,
    fiberContent,
    yardage: y.yardage,
    grams: y.grams,
    machineWashable: y.machine_washable,
    ratingAverage: y.rating_average,
    ratingCount: y.rating_count,
    photoUrl,
    description,
    discontinued: y.discontinued || false,
    gauge,
    needleSizes,
    texture: y.texture || null,
    wpi: y.wpi || null,
  };
}

/**
 * Map a Ravelry pattern object to our normalized shape.
 */
function mapPatternFields(p: any, isDetail: boolean = false) {
  // Designer
  const designer = p.pattern_author?.name || p.designer?.name || null;

  // Categories
  const categories = p.pattern_categories?.map((c: any) => c.name) || [];

  // Gauge
  let gauge: string | null = null;
  if (p.gauge_description) {
    gauge = p.gauge_description;
  } else if (p.gauge) {
    const divisor = p.gauge_divisor || 4;
    const pat = p.gauge_pattern || 'pattern';
    gauge = `${p.gauge} sts = ${divisor}" in ${pat}`;
  }

  // Needle sizes (array of needle objects)
  let needleSizes: any[] | null = null;
  const rawNeedles = p.pattern_needle_sizes || p.needle_sizes;
  if (Array.isArray(rawNeedles) && rawNeedles.length > 0) {
    needleSizes = rawNeedles
      .map((n: any) => {
        if (typeof n === 'string') return { name: n };
        const us = n.us ? `US ${n.us}` : '';
        const metric = n.metric ? `${n.metric} mm` : '';
        const name = [us, metric].filter(Boolean).join(' / ') || n.name;
        return name ? { name } : null;
      })
      .filter(Boolean);
  }

  // Sizes available
  let sizesAvailable: any[] | null = null;
  if (p.sizes_available) {
    sizesAvailable = Array.isArray(p.sizes_available) ? p.sizes_available : [p.sizes_available];
  }

  // Description: notes_html with HTML stripped
  let description: string | null = null;
  if (isDetail) {
    const raw = p.notes_html || p.notes;
    if (raw) {
      description = stripHtml(String(raw));
    }
  }

  return {
    id: p.id,
    name: p.name,
    designer,
    difficultyAverage: p.difficulty_average,
    ratingAverage: p.rating_average,
    yarnWeight: p.yarn_weight_description || p.yarn_weight?.name || null,
    yardageMax: p.yardage_max || p.yardage,
    photoUrl: p.first_photo?.medium_url || p.first_photo?.small_url || p.photos?.[0]?.medium_url || null,
    photoSquareUrl: p.first_photo?.square_url || null,
    categories,
    craft: p.craft?.name || null,
    description,
    gauge,
    needleSizes,
    sizesAvailable,
    yarnSuggestions: p.packs?.map((pack: any) => ({
      yarnName: pack.yarn_name,
      yarnCompany: pack.yarn?.yarn_company?.name || pack.yarn?.yarn_company_name,
      quantity: pack.quantity_description,
    })) || [],
  };
}

/** Build our normalized pagination shape from a Ravelry paginator. */
function buildPagination(
  paginator: any,
  fallbackPage: number,
  fallbackPageSize: number,
  itemCount: number
) {
  const p = paginator || {};
  return {
    page: p.page || fallbackPage,
    pageSize: p.page_size || fallbackPageSize,
    totalResults: p.results ?? itemCount,
    totalPages: p.last_page || 1,
  };
}

/**
 * Map a stash entry from `/people/:username/stash/list.json` to our normalized shape.
 * Returns both the stash entry id and the yarn model id so the import controller
 * can decide dedup strategy (same yarn × different colors is a real case).
 */
function mapStashEntry(entry: any) {
  const yarn = entry.yarn || {};
  const brand = yarn.yarn_company?.name || yarn.yarn_company_name || entry.yarn_company_name || null;
  const weight = yarn.yarn_weight?.name || entry.yarn_weight?.name || null;

  let fiberContent: string | null = null;
  const fibers = yarn.yarn_fibers || entry.yarn_fibers;
  if (Array.isArray(fibers) && fibers.length > 0) {
    fiberContent = fibers
      .map((f: any) => {
        const name = f.fiber_type?.name || f.name;
        const pct = f.percentage;
        return pct ? `${pct}% ${name}` : name;
      })
      .filter(Boolean)
      .join(', ');
  }

  const photoUrl =
    entry.photos?.[0]?.medium_url ||
    entry.photos?.[0]?.small_url ||
    entry.first_photo?.medium_url ||
    entry.first_photo?.small_url ||
    null;

  return {
    ravelryStashId: entry.id,
    ravelryYarnId: yarn.id ?? entry.yarn_id ?? null,
    name: entry.name || yarn.name || null,
    brand,
    color: entry.colorway || entry.color || null,
    colorFamily: entry.color_family_name || null,
    dyeLot: entry.dye_lot || null,
    weight,
    fiberContent,
    grams: entry.grams ?? null,
    meters: entry.meters ?? null,
    yards: entry.yards ?? null,
    skeins: entry.skeins ?? entry.total_skeins ?? null,
    photoUrl,
    notes: entry.notes ? stripHtml(String(entry.notes)) : null,
  };
}

/** Normalize a Ravelry project list entry. */
function mapProjectEntry(p: any) {
  // Ravelry status_name strings: "In progress", "Finished", "Hibernating", "Frogged"
  const rawStatus = (p.status_name || '').toLowerCase();
  const status =
    rawStatus.includes('finish') ? 'finished' :
    rawStatus.includes('hibernat') ? 'hibernating' :
    rawStatus.includes('frog') ? 'frogged' :
    rawStatus.includes('progress') ? 'in_progress' :
    null;

  return {
    ravelryProjectId: p.id,
    name: p.name || null,
    status,
    rawStatusName: p.status_name || null,
    patternRavelryId: p.pattern_id ?? null,
    patternName: p.pattern_name || null,
    startedDate: p.started || null,
    completedDate: p.completed || null,
    craft: p.craft?.name || null,
    photoUrl: p.first_photo?.medium_url || p.first_photo?.small_url || null,
    notes: p.notes ? stripHtml(String(p.notes)) : null,
    progressPercentage: typeof p.progress === 'number' ? p.progress : null,
  };
}

/** Normalize a queue entry from `/people/:username/queue/list.json`. */
function mapQueueEntry(q: any) {
  return {
    ravelryQueueId: q.id,
    name: q.name || null,
    patternRavelryId: q.pattern_id ?? null,
    patternName: q.pattern_name || null,
    patternAuthor: q.pattern_author_name || null,
    yarnRavelryId: q.yarn_id ?? null,
    yarnName: q.yarn_name || null,
    skeins: q.skeins ?? null,
    position: typeof q.position === 'number' ? q.position : null,
    notes: q.notes ? stripHtml(String(q.notes)) : null,
  };
}

/**
 * Normalize a library entry from `/people/:username/library/list.json`.
 * Library entries are "volumes" (books or standalone patterns).
 */
function mapLibraryEntry(v: any) {
  const rawType = (v.type || v.volume_type || '').toLowerCase();
  const type = rawType.includes('book') ? 'book' : rawType.includes('pattern') ? 'pattern' : rawType || null;

  const author =
    v.author?.name ||
    v.pattern_source?.name ||
    v.book?.author?.name ||
    null;

  const photoUrl =
    v.cover?.medium_url ||
    v.cover?.small_url ||
    v.pattern?.first_photo?.medium_url ||
    v.first_photo?.medium_url ||
    null;

  const patternIds: number[] = Array.isArray(v.pattern_ids)
    ? v.pattern_ids.filter((id: any) => typeof id === 'number')
    : v.pattern?.id
      ? [v.pattern.id]
      : [];

  return {
    ravelryLibraryId: v.id,
    type,
    title: v.title || v.pattern?.name || v.book?.title || null,
    author,
    photoUrl,
    addedAt: v.added_at || v.created_at || null,
    patternIds,
  };
}

interface RavelryYarnSearchResult {
  yarns: Array<{
    id: number;
    name: string;
    yarn_company_name: string;
    yarn_weight: { name: string } | null;
    fiber_content: { fiber_type: { name: string }; percentage: number }[] | null;
    yardage: number | null;
    grams: number | null;
    machine_washable: boolean | null;
    rating_average: number | null;
    rating_count: number | null;
    first_photo: { small_url: string; medium_url: string } | null;
  }>;
  paginator: {
    page: number;
    page_size: number;
    results: number;
    last_page: number;
  };
}

interface RavelryPatternSearchResult {
  patterns: Array<{
    id: number;
    name: string;
    designer: { name: string } | null;
    difficulty_average: number | null;
    difficulty_count: number | null;
    rating_average: number | null;
    yarn_weight_description: string | null;
    yardage_max: number | null;
    first_photo: { small_url: string; medium_url: string; square_url: string } | null;
    pattern_categories: Array<{ name: string }> | null;
    craft: { name: string } | null;
  }>;
  paginator: {
    page: number;
    page_size: number;
    results: number;
    last_page: number;
  };
}

class RavelryService {
  private basicClient: AxiosInstance | null = null;

  /**
   * Get Basic Auth client for reference endpoints that don't require OAuth
   */
  private getBasicClient(): AxiosInstance {
    if (!this.basicClient) {
      const username = process.env.RAVELRY_USERNAME;
      const password = process.env.RAVELRY_PASSWORD;

      if (!username || !password) {
        throw new RavelryNotConfiguredError();
      }

      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      this.basicClient = axios.create({
        baseURL: 'https://api.ravelry.com',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
        timeout: 15000,
      });
    }

    return this.basicClient;
  }

  /**
   * Get OAuth client for a specific user's access token. Every request is
   * gated by the shared Ravelry throttle via an interceptor, so callers
   * don't have to remember to acquire it manually.
   */
  private getOAuthClient(accessToken: string): AxiosInstance {
    const client = axios.create({
      baseURL: 'https://api.ravelry.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
    client.interceptors.request.use(async (config) => {
      await ravelryThrottle.acquire();
      return config;
    });
    return client;
  }

  /**
   * Resolve a user's Ravelry username. Stored on the tokens row during OAuth;
   * falls back to `/current_user.json` if missing, then throws if still unknown.
   */
  private async resolveRavelryUsername(userId: string, client: AxiosInstance): Promise<string> {
    const status = await ravelryOAuthService.getConnectionStatus(userId);
    if (status.ravelryUsername) return status.ravelryUsername;

    try {
      const meResponse = await client.get('/current_user.json');
      const username = meResponse.data?.user?.username;
      if (username) return username;
    } catch {
      // fall through
    }

    logger.warn('Ravelry: no username for user', { userId });
    throw new RavelryOAuthRequiredError();
  }

  /**
   * Get an authenticated client for a user (OAuth required for search/detail endpoints)
   */
  private async getClientForUser(userId: string): Promise<AxiosInstance> {
    const token = await ravelryOAuthService.getValidTokenForUser(userId);
    if (!token) {
      throw new RavelryOAuthRequiredError();
    }
    return this.getOAuthClient(token);
  }

  /**
   * Search yarns in the Ravelry database (requires OAuth)
   */
  async searchYarns(
    query: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: { weight?: string; fiberContent?: string },
    userId?: string
  ): Promise<{ yarns: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);

      const params: Record<string, string | number> = {
        query,
        page,
        page_size: pageSize,
      };

      if (filters?.weight) {
        params.weight = filters.weight;
      }
      if (filters?.fiberContent) {
        params.fiber = filters.fiberContent;
      }

      const response = await client.get<RavelryYarnSearchResult>('/yarns/search.json', { params });

      const yarns = (response.data.yarns || []).map((y: any) => mapYarnFields(y));

      return {
        yarns,
        pagination: {
          page: response.data.paginator.page,
          pageSize: response.data.paginator.page_size,
          totalResults: response.data.paginator.results,
          totalPages: response.data.paginator.last_page,
        },
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry yarn search failed', {
        query,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get detailed yarn information by ID (requires OAuth)
   */
  async getYarn(id: number, userId?: string): Promise<any | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const response = await client.get(`/yarns/${id}.json`);
      const y = response.data.yarn;

      if (!y) return null;

      return mapYarnFields(y, true);
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry get yarn failed', {
        id,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Search patterns in the Ravelry database (requires OAuth)
   */
  async searchPatterns(
    query: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: { craft?: string; difficulty?: string; weight?: string },
    userId?: string
  ): Promise<{ patterns: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);

      const params: Record<string, string | number> = {
        query,
        page,
        page_size: pageSize,
      };

      if (filters?.craft) {
        params.craft = filters.craft;
      }
      if (filters?.difficulty) {
        params.diff = filters.difficulty;
      }
      if (filters?.weight) {
        params.weight = filters.weight;
      }

      const response = await client.get<RavelryPatternSearchResult>('/patterns/search.json', { params });

      const patterns = (response.data.patterns || []).map((p: any) => mapPatternFields(p));

      return {
        patterns,
        pagination: {
          page: response.data.paginator.page,
          pageSize: response.data.paginator.page_size,
          totalResults: response.data.paginator.results,
          totalPages: response.data.paginator.last_page,
        },
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry pattern search failed', {
        query,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get detailed pattern information by ID (requires OAuth)
   */
  async getPattern(id: number, userId?: string): Promise<any | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const response = await client.get(`/patterns/${id}.json`);
      const p = response.data.pattern;

      if (!p) return null;

      return mapPatternFields(p, true);
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry get pattern failed', {
        id,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get the current user's favorite patterns from Ravelry (requires OAuth).
   *
   * Calls Ravelry's `/people/{username}/favorites/list.json` endpoint with types=pattern
   * and returns the favorited patterns normalized via mapPatternFields — same shape that
   * the frontend pattern import flow already consumes.
   */
  async getFavorites(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ patterns: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/people/${encodeURIComponent(username)}/favorites/list.json`,
        {
          params: {
            types: 'pattern',
            page,
            page_size: pageSize,
          },
        }
      );

      const favorites: any[] = response.data.favorites || [];
      const patterns = favorites
        .map((f: any) => {
          const favorited = f?.favorited;
          if (!favorited || !favorited.id) return null;
          return mapPatternFields(favorited);
        })
        .filter(Boolean);

      return {
        patterns,
        pagination: buildPagination(response.data.paginator, page, pageSize, patterns.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry get favorites failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get the current user's favorite yarns from Ravelry (requires OAuth).
   * Same shape as `getFavorites` but with `types=yarn`; returns normalized yarns.
   */
  async getFavoriteYarns(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ yarns: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/people/${encodeURIComponent(username)}/favorites/list.json`,
        {
          params: {
            types: 'yarn',
            page,
            page_size: pageSize,
          },
        }
      );

      const favorites: any[] = response.data.favorites || [];
      const yarns = favorites
        .map((f: any) => {
          const favorited = f?.favorited;
          if (!favorited || !favorited.id) return null;
          return mapYarnFields(favorited);
        })
        .filter(Boolean);

      return {
        yarns,
        pagination: buildPagination(response.data.paginator, page, pageSize, yarns.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry get favorite yarns failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * List the current user's Ravelry stash (requires OAuth). Paginated — caller
   * is expected to loop pages and show progress. Each entry includes the
   * stash id and the yarn model id so import controllers can decide which to
   * persist as `yarn.ravelry_id`.
   */
  async listStash(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ stash: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/people/${encodeURIComponent(username)}/stash/list.json`,
        { params: { page, page_size: pageSize } }
      );

      const stash = (response.data.stash || []).map(mapStashEntry);
      return {
        stash,
        pagination: buildPagination(response.data.paginator, page, pageSize, stash.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry list stash failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * List the current user's Ravelry projects (requires OAuth). Uses the
   * `/projects/:username/list.json` endpoint (note: `/projects/`, not `/people/`).
   */
  async listProjects(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ projects: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/projects/${encodeURIComponent(username)}/list.json`,
        { params: { page, page_size: pageSize } }
      );

      const projects = (response.data.projects || []).map(mapProjectEntry);
      return {
        projects,
        pagination: buildPagination(response.data.paginator, page, pageSize, projects.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry list projects failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * List the current user's Ravelry queue — the "to knit" list.
   */
  async listQueue(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ queue: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/people/${encodeURIComponent(username)}/queue/list.json`,
        { params: { page, page_size: pageSize } }
      );

      const queue = (response.data.queued_projects || []).map(mapQueueEntry);
      return {
        queue,
        pagination: buildPagination(response.data.paginator, page, pageSize, queue.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry list queue failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * List the current user's Ravelry library — purchased patterns + books.
   */
  async listLibrary(
    userId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ library: any[]; pagination: any } | null> {
    try {
      if (!userId) throw new RavelryOAuthRequiredError();
      const client = await this.getClientForUser(userId);
      const username = await this.resolveRavelryUsername(userId, client);

      const response = await client.get(
        `/people/${encodeURIComponent(username)}/library/list.json`,
        { params: { page, page_size: pageSize } }
      );

      const library = (response.data.volumes || response.data.library || []).map(mapLibraryEntry);
      return {
        library,
        pagination: buildPagination(response.data.paginator, page, pageSize, library.length),
      };
    } catch (error: any) {
      if (error instanceof RavelryOAuthRequiredError) throw error;
      logger.error('Ravelry list library failed', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get yarn weights reference data (works with Basic Auth)
   */
  async getYarnWeights(): Promise<any[] | null> {
    try {
      const client = this.getBasicClient();
      const response = await client.get('/yarn_attributes/groups.json');
      return response.data.yarn_attribute_groups || [];
    } catch (error: any) {
      if (error instanceof RavelryNotConfiguredError) throw error;
      logger.error('Ravelry get yarn weights failed', {
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }

  /**
   * Get color families reference data (works with Basic Auth)
   */
  async getColorFamilies(): Promise<any[] | null> {
    try {
      const client = this.getBasicClient();
      const response = await client.get('/fiber_attributes.json');
      return response.data.fiber_attributes || [];
    } catch (error: any) {
      if (error instanceof RavelryNotConfiguredError) throw error;
      logger.error('Ravelry get color families failed', {
        error: error.message,
        status: error.response?.status,
      });
      return null;
    }
  }
}

export class RavelryNotConfiguredError extends Error {
  constructor() {
    super('Ravelry API credentials are not configured. Set RAVELRY_USERNAME and RAVELRY_PASSWORD environment variables.');
    this.name = 'RavelryNotConfiguredError';
  }
}

export class RavelryOAuthRequiredError extends Error {
  constructor() {
    super('Please connect your Ravelry account to search yarns and patterns.');
    this.name = 'RavelryOAuthRequiredError';
  }
}

// Export singleton instance
const ravelryService = new RavelryService();
export default ravelryService;
