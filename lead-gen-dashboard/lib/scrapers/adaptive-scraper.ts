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
  fallbackToCheerio?: boolean;
  forceMethod?: 'cheerio' | 'puppeteer';
  userAgent?: string;
}

export class AdaptiveScraper {
  private scraper: WebScraper | CheerioScraper;
  private config: ScraperConfig;
  private method: 'cheerio' | 'puppeteer';

  constructor(config: ScraperConfig = {}) {
    this.config = {
      fallbackToCheerio: false,
      ...config,
    };

    const isServerless =
      this.config.forceMethod === 'cheerio' ||
      this.config.fallbackToCheerio ||
      !!process.env.VERCEL ||
      !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NODE_ENV === 'production';

    this.method =
      this.config.forceMethod ||
      (isServerless ? 'cheerio' : 'puppeteer');

    console.log(
      `[ADAPTIVE SCRAPER] Using ${this.method} method in ${
        process.env.NODE_ENV || 'local'
      } environment`
    );

    if (this.method === 'cheerio') {
      this.scraper = new CheerioScraper({
        timeout: this.config.timeout ?? 15000,
        delayBetweenRequests:
          this.config.delayBetweenRequests ?? 500,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      });
    } else {
      this.scraper = new WebScraper({
        headless: this.config.headless ?? true,
        timeout: this.config.timeout ?? 30000,
        delayBetweenRequests:
          this.config.delayBetweenRequests ?? 1000,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      });
    }
  }

  getMethod(): 'cheerio' | 'puppeteer' {
    return this.method;
  }

  async initialize(): Promise<void> {
    if (this.method === 'puppeteer') {
      await (this.scraper as WebScraper).initialize();
    }
  }

  async close(): Promise<void> {
    if (this.method === 'puppeteer') {
      await (this.scraper as WebScraper).close();
    }
  }

  async scrapePage(url: string): Promise<ScrapedPage> {
    if (this.method === 'puppeteer') {
      return (this.scraper as WebScraper).scrapePage(url);
    }

    return (this.scraper as CheerioScraper).scrapePage(url);
  }

  async scrapePages(urls: string[]): Promise<ScrapedPage[]> {
    if (this.method === 'puppeteer') {
      return (this.scraper as WebScraper).scrapePages(urls);
    }

    return (this.scraper as CheerioScraper).scrapePages(urls);
  }

  getInfo() {
    return {
      method: this.method,
      environment: process.env.NODE_ENV || 'local',
      isVercel: !!process.env.VERCEL,
      isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
      capabilities: {
        dynamicContent: this.method === 'puppeteer',
        needsBrowser: this.method === 'puppeteer',
        cost:
          this.method === 'cheerio'
            ? 'FREE'
            : 'FREE (local only)',
      },
    };
  }
}

export default AdaptiveScraper;