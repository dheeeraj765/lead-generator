/**
 * Adaptive Scraper - Automatically chooses the best scraping method:
 * - Vercel / Serverless / Production → Cheerio (free, no binary needed)
 * - Local / Docker                   → Puppeteer (full JS support)
 *
 * FIX: Both scrapers are now loaded via dynamic import() instead of static
 * top-level imports.  Static imports caused puppeteer to be evaluated at
 * module-init time on Vercel, where no Chromium binary exists, which threw
 * an unhandled exception before the route handler ever ran — producing an
 * HTML 500 page instead of a JSON response.
 */

import type { ScrapedPage } from "./puppeteer-scraper";

export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  delayBetweenRequests?: number;
  maxRetries?: number;
  fallbackToCheerio?: boolean;
  forceMethod?: "cheerio" | "puppeteer";
  userAgent?: string;
}

export class AdaptiveScraper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private scraperInstance: any | null = null;
  private config: ScraperConfig;
  private method: "cheerio" | "puppeteer";

  constructor(config: ScraperConfig = {}) {
    this.config = {
      fallbackToCheerio: false,
      ...config,
    };

    const isServerless =
      this.config.forceMethod === "cheerio" ||
      this.config.fallbackToCheerio ||
      !!process.env.VERCEL ||
      !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NODE_ENV === "production";

    this.method =
      this.config.forceMethod || (isServerless ? "cheerio" : "puppeteer");

    console.log(
      `[ADAPTIVE SCRAPER] Using ${this.method} method in ${
        process.env.NODE_ENV || "local"
      } environment`
    );
  }

  // ---------------------------------------------------------------------------
  // Private: lazy-load the correct scraper on first use
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getScraper(): Promise<any> {
    if (this.scraperInstance) return this.scraperInstance;

    if (this.method === "cheerio") {
      const { CheerioScraper } = await import("./cheerio-scraper");
      this.scraperInstance = new CheerioScraper({
        timeout: this.config.timeout ?? 15000,
        delayBetweenRequests: this.config.delayBetweenRequests ?? 500,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      });
    } else {
      const WebScraper = (await import("./puppeteer-scraper")).default;
      this.scraperInstance = new WebScraper({
        headless: this.config.headless ?? true,
        timeout: this.config.timeout ?? 30000,
        delayBetweenRequests: this.config.delayBetweenRequests ?? 1000,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      });
    }

    return this.scraperInstance;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getMethod(): "cheerio" | "puppeteer" {
    return this.method;
  }

  async initialize(): Promise<void> {
    if (this.method === "puppeteer") {
      const scraper = await this.getScraper();
      await scraper.initialize();
    }
  }

  async close(): Promise<void> {
    if (this.method === "puppeteer" && this.scraperInstance) {
      await this.scraperInstance.close();
    }
  }

  async scrapePage(url: string): Promise<ScrapedPage> {
    const scraper = await this.getScraper();
    return scraper.scrapePage(url);
  }

  async scrapePages(urls: string[]): Promise<ScrapedPage[]> {
    const scraper = await this.getScraper();
    return scraper.scrapePages(urls);
  }

  getInfo() {
    return {
      method: this.method,
      environment: process.env.NODE_ENV || "local",
      isVercel: !!process.env.VERCEL,
      isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
      capabilities: {
        dynamicContent: this.method === "puppeteer",
        needsBrowser: this.method === "puppeteer",
        cost: this.method === "cheerio" ? "FREE" : "FREE (local only)",
      },
    };
  }
}

export default AdaptiveScraper;