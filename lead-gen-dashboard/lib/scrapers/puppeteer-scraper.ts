/**
 * Web Scraper Module - Puppeteer-based web scraping with anti-detection
 * Includes stealth techniques, error handling, and rate limiting
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  delayBetweenRequests?: number; // ms to wait between requests
  maxRetries?: number;
  userAgent?: string;
  acceptLanguage?: string;
}

export interface ScrapedPage {
  url: string;
  html: string;
  title: string;
  statusCode?: number;
}

export class WebScraper {
  private browser: Browser | null = null;
  private config: Required<ScraperConfig>;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      delayBetweenRequests: config.delayBetweenRequests ?? 1000,
      maxRetries: config.maxRetries ?? 3,
      userAgent:
        config.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptLanguage: config.acceptLanguage || 'en-US,en;q=0.9',
    };
  }

  /**
   * Initialize browser with stealth mode
   */
  async initialize(): Promise<void> {
    try {
      // Add stealth plugin
      const extra = require('puppeteer-extra');
      extra.use(StealthPlugin());

      this.browser = await extra.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-sync',
          '--disable-plugins',
          '--disable-notifications',
          '--disable-popup-blocking',
        ],
      });

      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Close browser connection
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a single page with retry logic
   */
  async scrapePage(url: string, retries = 0): Promise<ScrapedPage> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();

    try {
      // Set user agent and headers
      await page.setUserAgent(this.config.userAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': this.config.acceptLanguage,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
      });

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set timeout
      page.setDefaultTimeout(this.config.timeout);
      page.setDefaultNavigationTimeout(this.config.timeout);

      // Navigate to page
      console.log(`Fetching: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
      });

      // Wait for dynamic content to load
      await this.waitForDynamicContent(page);

      // Get page content
      const html = await page.content();
      const title = await page.title();

      return {
        url,
        html,
        title,
        statusCode: 200,
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);

      // Retry logic
      if (retries < this.config.maxRetries) {
        console.log(
          `Retrying ${url} (attempt ${retries + 1}/${this.config.maxRetries})`
        );
        await this.delay(this.config.delayBetweenRequests * (retries + 1));
        return this.scrapePage(url, retries + 1);
      }

      throw new Error(`Failed to scrape ${url} after ${this.config.maxRetries} retries`);
    } finally {
      await page.close();
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
   * Search on Justdial-like sites and scrape results
   * Needs to be customized based on target site
   */
  async searchAndScrape(
    searchTerm: string,
    location: string,
    maxPages: number = 1
  ): Promise<ScrapedPage[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const results: ScrapedPage[] = [];

    // Note: This is a template - actual Justdial scraping would need
    // specific selectors and pagination logic
    const baseUrl = `https://www.justdial.com/${location}/${searchTerm}`;

    const page = await this.browser.newPage();

    try {
      await page.setUserAgent(this.config.userAgent);
      await page.goto(baseUrl, { waitUntil: 'networkidle2' });

      // Scrape current page
      const html = await page.content();
      results.push({
        url: baseUrl,
        html,
        title: await page.title(),
      });

      // Pagination (if multiple pages requested)
      for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
        try {
          // Look for "Next" button and click it
          const nextButton = await page.$(
            'a[aria-label*="next"], .pagination .next, button:contains("Next")'
          );

          if (!nextButton) {
            console.log('No more pages available');
            break;
          }

          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
          await this.waitForDynamicContent(page);

          const pageHtml = await page.content();
          results.push({
            url: page.url(),
            html: pageHtml,
            title: await page.title(),
          });

          // Rate limit
          await this.delay(this.config.delayBetweenRequests);
        } catch (error) {
          console.error(`Error scraping page ${pageNum}:`, error);
          break;
        }
      }
    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Wait for dynamic content to load
   * Can be customized for specific page structures
   */
  private async waitForDynamicContent(page: Page): Promise<void> {
    try {
      // Wait for common listing selectors
      await Promise.race([
        page.waitForSelector('.listing-item, .business-card, .search-result', {
          timeout: 10000,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)), // Max 3 seconds
      ]);

      // Additional wait for lazy-loaded content
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let lastHeight = document.body.scrollHeight;
          let scrolls = 0;
          const maxScrolls = 3;

          const scroll = () => {
            window.scrollBy(0, window.innerHeight);
            scrolls++;

            setTimeout(() => {
              const newHeight = document.body.scrollHeight;
              if (newHeight > lastHeight && scrolls < maxScrolls) {
                lastHeight = newHeight;
                scroll();
              } else {
                resolve(undefined);
              }
            }, 1000);
          };

          scroll();
        });
      });
    } catch (error) {
      console.log('Dynamic content wait timed out or failed (continuing anyway)');
    }
  }

  /**
   * Delay execution (for rate limiting)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if URL is accessible
   */
  async checkUrlAccessibility(url: string): Promise<boolean> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      return true;
    } catch {
      return false;
    } finally {
      await page.close();
    }
  }

  /**
   * Get screenshot (useful for debugging)
   */
  async takeScreenshot(url: string, filename: string): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Screenshot saved: ${filename}`);
    } finally {
      await page.close();
    }
  }
}

export default WebScraper;
