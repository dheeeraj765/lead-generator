/**
 * Adaptive Scraper - Automatically chooses the best solution:
 * - Vercel/Serverless: Cheerio (free, lightweight, no browser)
 * - Local/Docker: Puppeteer (full JavaScript support, dynamic content)
 * - AWS Lambda: Cheerio (same as serverless)
 */

import WebScraper from './puppeteer-scraper';
import CheerioScraper from './cheerio-scraper';
import type { ScrapedPage } from './puppeteer-scraper';

export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  delayBetweenRequests?: number;
  maxRetries?: number;
  userAgent?: string;
  forceMethod?: 'cheerio' | 'puppeteer'; // Override auto-detection for testing
}

export class AdaptiveScraper {
  private scraper: WebScraper | CheerioScraper;
  private config: ScraperConfig;
  private method: 'cheerio' | 'puppeteer';

  constructor(config: ScraperConfig = {}) {
    this.config = config;

    // Auto-detect environment
    const isServerless =
      config.forceMethod === 'cheerio' ||
      (!!process.env.VERCEL ||
        !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NODE_ENV === 'production');

    this.method = config.forceMethod || (isServerless ? 'cheerio' : 'puppeteer');

    console.log(
      `[ADAPTIVE SCRAPER] Using ${this.method} method in ${process.env.NODE_ENV || 'local'} environment`
    );

    if (this.method === 'cheerio') {
      this.scraper = new CheerioScraper({
        timeout: config.timeout ?? 15000,
        delayBetweenRequests: config.delayBetweenRequests ?? 500,
        maxRetries: config.maxRetries ?? 2,
        userAgent: config.userAgent,
      });
    } else {
      this.scraper = new WebScraper({
        headless: config.headless ?? true,
        timeout: config.timeout ?? 30000,
        delayBetweenRequests: config.delayBetweenRequests ?? 1000,
        maxRetries: config.maxRetries ?? 2,
        userAgent: config.userAgent,
      });
    }
  }

  /**
   * Get which scraper method is being used
   */
  getMethod(): 'cheerio' | 'puppeteer' {
    return this.method;
  }

  /**
   * Initialize if needed (Puppeteer requires this)
   */
  async initialize(): Promise<void> {
    if (this.method === 'puppeteer') {
      await (this.scraper as WebScraper).initialize();
    }
    // Cheerio doesn't need initialization
  }

  /**
   * Close if needed (Puppeteer requires this)
   */
  async close(): Promise<void> {
    if (this.method === 'puppeteer') {
      await (this.scraper as WebScraper).close();
    }
    // Cheerio doesn't need cleanup
  }

  /**
   * Scrape a single page
   */
  async scrapePage(url: string): Promise<ScrapedPage> {
    if (this.method === 'puppeteer') {
      return (this.scraper as WebScraper).scrapePage(url);
    } else {
      return (this.scraper as CheerioScraper).scrapePage(url);
    }
  }

  /**
   * Scrape multiple pages
   */
  async scrapePages(urls: string[]): Promise<ScrapedPage[]> {
    if (this.method === 'puppeteer') {
      return (this.scraper as WebScraper).scrapePages(urls);
    } else {
      return (this.scraper as CheerioScraper).scrapePages(urls);
    }
  }

  /**
   * Get scraper info for debugging
   */
  getInfo() {
    return {
      method: this.method,
      environment: process.env.NODE_ENV || 'local',
      isVercel: !!process.env.VERCEL,
      isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
      capabilities: {
        dynamicContent: this.method === 'puppeteer',
        needsBrowser: this.method === 'puppeteer',
        cost: this.method === 'cheerio' ? 'FREE' : 'FREE (local only)',
      },
    };
  }
}

export default AdaptiveScraper;
