/**
 * Lightweight Cheerio-based Scraper - No browser needed, completely free
 * Perfect for Vercel and serverless environments
 * Works for static HTML content
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScraperConfig {
  timeout?: number;
  delayBetweenRequests?: number;
  maxRetries?: number;
  userAgent?: string;
}

export interface ScrapedPage {
  url: string;
  html: string;
  title: string;
  statusCode?: number;
}

export class CheerioScraper {
  private config: Required<ScraperConfig>;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      delayBetweenRequests: config.delayBetweenRequests ?? 500,
      maxRetries: config.maxRetries ?? 2,
      userAgent:
        config.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  /**
   * Scrape a single page using HTTP requests (no browser needed)
   * Works for static HTML and server-rendered content
   */
  async scrapePage(url: string, retries = 0): Promise<ScrapedPage> {
    try {
      console.log(`Fetching: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: this.config.timeout,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const title = $('title').text() || 'Unknown';

      return {
        url,
        html: response.data,
        title,
        statusCode: response.status,
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);

      if (retries < this.config.maxRetries) {
        console.log(
          `Retrying ${url} (attempt ${retries + 1}/${this.config.maxRetries})`
        );
        await this.delay(this.config.delayBetweenRequests * (retries + 1));
        return this.scrapePage(url, retries + 1);
      }

      throw new Error(
        `Failed to scrape ${url} after ${this.config.maxRetries} retries: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Scrape multiple pages sequentially with rate limiting
   */
  async scrapePages(urls: string[]): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const page = await this.scrapePage(urls[i]);
        results.push(page);

        // Rate limiting: wait between requests
        if (i < urls.length - 1) {
          await this.delay(this.config.delayBetweenRequests);
        }
      } catch (error) {
        console.error(`Failed to scrape URL ${i + 1}/${urls.length}:`, error);
        // Continue with next URL on error
      }
    }

    return results;
  }

  /**
   * Search and scrape results (simplified for Justdial-like sites)
   */
  async searchAndScrape(
    searchTerm: string,
    location: string,
    maxPages: number = 1
  ): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = [];

    // Construct search URL
    const baseUrl = `https://www.justdial.com/${location}/${searchTerm}`;

    const pages = await this.scrapePages([baseUrl]);
    results.push(...pages);

    return results;
  }

  /**
   * Extract all links from a page
   */
  extractLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a[href]').each((_index, element) => {
      const href = $(element).attr('href');
      if (
        href &&
        !href.startsWith('#') &&
        !href.startsWith('javascript:') &&
        !href.includes('facebook.com') &&
        !href.includes('twitter.com')
      ) {
        links.add(href);
      }
    });

    return Array.from(links);
  }

  /**
   * Parse HTML with CSS selectors
   */
  parseWithSelectors(
    html: string,
    selectors: {
      container: string;
      name: string;
      phone: string;
      address: string;
      website?: string;
    }
  ): Array<{
    businessName?: string;
    phone?: string;
    address?: string;
    website?: string;
  }> {
    const $ = cheerio.load(html);
    const results: Array<{
      businessName?: string;
      phone?: string;
      address?: string;
      website?: string;
    }> = [];

    $(`${selectors.container}`).each((_index, element) => {
      try {
        const container = $(element);

        const businessName = container
          .find(selectors.name)
          .text()
          .trim();
        const phone = container.find(selectors.phone).text().trim();
        const address = container.find(selectors.address).text().trim();
        const website = selectors.website
          ? container.find(selectors.website).attr('href') || ''
          : '';

        if (businessName) {
          results.push({
            businessName,
            phone: phone || undefined,
            address: address || undefined,
            website: website || undefined,
          });
        }
      } catch (error) {
        console.error('Error parsing element:', error);
      }
    });

    return results;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default CheerioScraper;
