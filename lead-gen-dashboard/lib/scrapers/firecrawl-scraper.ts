/**
 * Firecrawl Adapter - Serverless-friendly web scraping
 * Uses Firecrawl API instead of Puppeteer for Vercel/serverless compatibility
 * 
 * Sign up: https://www.firecrawl.dev
 * API: https://docs.firecrawl.dev
 */

import axios from 'axios';

export interface FirecrawlConfig {
  apiKey?: string;
  enabled?: boolean;
}

export class FirecrawlScraper {
  private apiKey: string;
  private apiUrl = 'https://api.firecrawl.dev/v1';
  private enabled: boolean;

  constructor(config: FirecrawlConfig = {}) {
    this.apiKey = config.apiKey || process.env.FIRECRAWL_API_KEY || '';
    this.enabled = config.enabled !== false && !!this.apiKey;
  }

  /**
   * Check if Firecrawl is properly configured
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Scrape a URL using Firecrawl API
   */
  async scrapePage(url: string): Promise<string> {
    if (!this.enabled) {
      throw new Error(
        'Firecrawl not configured. Set FIRECRAWL_API_KEY environment variable.'
      );
    }

    try {
      console.log(`[Firecrawl] Scraping: ${url}`);

      const response = await axios.post(
        `${this.apiUrl}/scrape`,
        {
          url,
          formats: ['html'],
          timeout: 30000,
          waitFor: 2000, // Wait for JS to render
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          `Firecrawl failed: ${response.data.error || 'Unknown error'}`
        );
      }

      console.log(`[Firecrawl] Successfully scraped. Status: ${response.status}`);
      return response.data.html || response.data.content || '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[Firecrawl] API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        if (error.response?.status === 401) {
          throw new Error('Firecrawl API key invalid or expired');
        }
        if (error.response?.status === 429) {
          throw new Error('Firecrawl rate limit exceeded. Upgrade plan or wait.');
        }
      }

      throw error;
    }
  }

  /**
   * Scrape multiple URLs in sequence
   */
  async scrapePages(urls: string[]): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const html = await this.scrapePage(urls[i]);
        results.push(html);

        // Rate limiting: small delay between requests
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to scrape URL ${i + 1}/${urls.length}:`, error);
        // Continue with next URL on error
      }
    }

    return results;
  }

  /**
   * Search a website and get results (if available)
   * Firecrawl doesn't have native search - we scrape search results page
   */
  async searchAndScrape(
    keyword: string,
    location: string,
    site: string = 'justdial.com'
  ): Promise<string> {
    const searchUrl = `https://${site}/${location}/${keyword}`;
    return this.scrapePage(searchUrl);
  }

  /**
   * Get Firecrawl account status (credits remaining, etc.)
   */
  async getStatus(): Promise<any> {
    if (!this.enabled) {
      return {
        status: 'disabled',
        message: 'Firecrawl not configured',
      };
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/account`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return {
        status: 'enabled',
        credits: response.data.credits,
        creditsUsed: response.data.creditsUsed,
        plan: response.data.plan,
      };
    } catch (error) {
      console.error('Failed to get Firecrawl status:', error);
      return {
        status: 'error',
        message: 'Failed to fetch account status',
      };
    }
  }
}

export default FirecrawlScraper;
