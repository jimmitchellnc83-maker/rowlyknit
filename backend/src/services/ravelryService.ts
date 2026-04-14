import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import ravelryOAuthService from './ravelryOAuthService';

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
   * Get OAuth client for a specific user's access token
   */
  private getOAuthClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.ravelry.com',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
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

      const yarns = (response.data.yarns || []).map((y) => ({
        id: y.id,
        name: y.name,
        brand: y.yarn_company_name,
        weight: y.yarn_weight?.name || null,
        fiberContent: y.fiber_content
          ? y.fiber_content.map((f) => `${f.percentage}% ${f.fiber_type.name}`).join(', ')
          : null,
        yardage: y.yardage,
        grams: y.grams,
        machineWashable: y.machine_washable,
        ratingAverage: y.rating_average,
        ratingCount: y.rating_count,
        photoUrl: y.first_photo?.medium_url || y.first_photo?.small_url || null,
      }));

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

      return {
        id: y.id,
        name: y.name,
        brand: y.yarn_company_name,
        weight: y.yarn_weight?.name || null,
        fiberContent: y.fiber_content
          ? y.fiber_content.map((f: any) => `${f.percentage}% ${f.fiber_type.name}`).join(', ')
          : null,
        yardage: y.yardage,
        grams: y.grams,
        machineWashable: y.machine_washable,
        ratingAverage: y.rating_average,
        ratingCount: y.rating_count,
        photoUrl: y.photos?.[0]?.medium_url || null,
        description: y.notes || null,
        discontinued: y.discontinued,
        gaugeDescription: y.gauge_description,
        needleSizes: y.needle_sizes,
      };
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

      const patterns = (response.data.patterns || []).map((p) => ({
        id: p.id,
        name: p.name,
        designer: p.designer?.name || null,
        difficultyAverage: p.difficulty_average,
        ratingAverage: p.rating_average,
        yarnWeight: p.yarn_weight_description || null,
        yardageMax: p.yardage_max,
        photoUrl: p.first_photo?.medium_url || p.first_photo?.small_url || null,
        photoSquareUrl: p.first_photo?.square_url || null,
        categories: p.pattern_categories?.map((c) => c.name) || [],
        craft: p.craft?.name || null,
      }));

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

      return {
        id: p.id,
        name: p.name,
        designer: p.pattern_author?.name || null,
        difficultyAverage: p.difficulty_average,
        ratingAverage: p.rating_average,
        yarnWeight: p.yarn_weight_description || null,
        description: p.notes_html || p.notes || null,
        photoUrl: p.photos?.[0]?.medium_url || null,
        categories: p.pattern_categories?.map((c: any) => c.name) || [],
        craft: p.craft?.name || null,
        gauge: p.gauge_description,
        yardage: p.yardage_max,
        sizesAvailable: p.sizes_available,
        needleSizes: p.pattern_needle_sizes,
        yarnSuggestions: p.packs?.map((pack: any) => ({
          yarnName: pack.yarn_name,
          yarnCompany: pack.yarn?.yarn_company_name,
          quantity: pack.quantity_description,
        })) || [],
      };
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
