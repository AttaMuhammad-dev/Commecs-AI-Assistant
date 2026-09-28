import { config } from '../ingest.config.js';
import type { WpItem, WpCategory, WpMedia } from './types.js';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class WpClient {
  private enforceAllowlist(urlStr: string) {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' || !config.hostAllowlist.includes(url.hostname)) {
      throw new Error(`SECURITY VIOLATION: Attempted to fetch unauthorized host: ${url.hostname}`);
    }
  }

  private async fetchPolite(url: string, attempt = 1): Promise<Response> {
    this.enforceAllowlist(url);
    await delay(config.fetch.delayMs);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.fetch.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: { 'User-Agent': config.fetch.userAgent },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && attempt <= config.fetch.maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? Math.min(30000, (parseInt(retryAfter) || 2) * 1000) : attempt * 2000;
          console.warn(`[429] Rate limited on ${url}. Waiting ${waitMs}ms...`);
          await delay(waitMs);
          return this.fetchPolite(url, attempt + 1);
        }
        if (response.status >= 500 && attempt <= config.fetch.maxRetries) {
          await delay(attempt * 2000);
          return this.fetchPolite(url, attempt + 1);
        }
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt <= config.fetch.maxRetries) {
        await delay(attempt * 2000);
        return this.fetchPolite(url, attempt + 1);
      }
      throw error;
    }
  }

  async fetchAllPaginated<T>(endpoint: string, extraParams: string = ''): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${config.baseUrl}${endpoint}?per_page=100&page=${page}&${extraParams}`;
      const response = await this.fetchPolite(url);
      
      if (page === 1) {
        const headerTotal = response.headers.get('X-WP-TotalPages');
        if (headerTotal) totalPages = parseInt(headerTotal, 10);
      }
      
      const data = await response.json();
      results.push(...data);
      page++;
    }
    return results;
  }

  async getPages(): Promise<WpItem[]> {
    return this.fetchAllPaginated<WpItem>(config.apiPaths.pages, 'status=publish&_fields=id,slug,link,title,content,excerpt,modified_gmt,type');
  }

  async getPosts(): Promise<WpItem[]> {
    return this.fetchAllPaginated<WpItem>(config.apiPaths.posts, 'status=publish&_fields=id,slug,link,title,content,excerpt,modified_gmt,type,categories');
  }

  async getCategories(): Promise<WpCategory[]> {
    return this.fetchAllPaginated<WpCategory>(config.apiPaths.categories, '_fields=id,name');
  }

  async getPdfs(): Promise<WpMedia[]> {
    return this.fetchAllPaginated<WpMedia>(config.apiPaths.media, 'mime_type=application/pdf&_fields=id,title,source_url,modified_gmt,media_details');
  }
}