/**
 * Parser Module - Extracts structured data from raw HTML content
 * Handles different website formats and data extraction patterns
 */

import * as cheerio from 'cheerio';

export interface RawLead {
  businessName?: string;
  phone?: string;
  address?: string;
  website?: string;
  sourceUrl: string;
}

/**
 * Generic parser for business listings
 * Can be extended for specific websites (Justdial, Yellow Pages, etc.)
 */
export class LeadParser {
  /**
   * Extract leads from HTML using CSS selectors
   * Works for structured listings (divs, cards, list items)
   */
  static parseLeadsList(
    html: string,
    selectors: {
      container: string;
      name: string;
      phone: string;
      address: string;
      website?: string;
    }
  ): RawLead[] {
    const $ = cheerio.load(html);
    const leads: RawLead[] = [];

    $(`${selectors.container}`).each((_index, element) => {
      try {
        const container = $(element);
        
        const name = container.find(selectors.name).text().trim();
        const phone = container.find(selectors.phone).text().trim();
        const address = container.find(selectors.address).text().trim();
        const website = selectors.website
          ? container.find(selectors.website).attr('href') || ''
          : '';

        if (name) {
          leads.push({
            businessName: name,
            phone: phone || undefined,
            address: address || undefined,
            website: website || undefined,
            sourceUrl: '', // Will be set by scraper
          });
        }
      } catch (error) {
        console.error('Error parsing individual lead:', error);
      }
    });

    return leads;
  }

  /**
   * Parse Justdial-specific format
   * Note: Selectors may vary based on Justdial UI updates
   */
  static parseJustdial(html: string, sourceUrl: string): RawLead[] {
    const $ = cheerio.load(html);
    const leads: RawLead[] = [];

    // Justdial business listings typically use .listing-box or similar containers
    $('.business-listing, .listing-item, .search-results-item').each(
      (_index, element) => {
        try {
          const $item = $(element);

          // Extract business name
          const businessName = $item
            .find('h2, .business-name, .listing-title, a.business-link')
            .first()
            .text()
            .trim();

          // Extract phone number(s)
          let phone = '';
          const phoneElements = $item.find('.phone-number, [data-phone], .mobile-number');
          if (phoneElements.length > 0) {
            phone = phoneElements.first().text().trim();
          }

          // Extract address
          const address = $item
            .find('.address, .location, .business-address, .area')
            .text()
            .trim();

          // Extract website
          let website = '';
          const websiteLink = $item.find('a[href*="http"]:not([href*="justdial"])');
          if (websiteLink.length > 0) {
            website = websiteLink.attr('href') || '';
          }

          if (businessName) {
            leads.push({
              businessName,
              phone: phone || undefined,
              address: address || undefined,
              website: website || undefined,
              sourceUrl,
            });
          }
        } catch (error) {
          console.error('Error parsing Justdial listing:', error);
        }
      }
    );

    return leads;
  }

  /**
   * Extract all text nodes and phone-like patterns for fallback parsing
   * Useful when structured selectors fail
   */
  static parseUnstructuredData(html: string, sourceUrl: string): RawLead[] {
    const $ = cheerio.load(html);
    
    // Extract potential business names, phones, addresses using patterns
    const phonePattern = /(\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;
    const allText = $.text();
    
    // This is a basic fallback - real implementation would need more sophisticated parsing
    const leads: RawLead[] = [];
    
    const phones = allText.match(phonePattern) || [];
    
    // Limit fallback results to avoid noise
    if (phones.length > 0) {
      leads.push({
        businessName: 'Unknown',
        phone: phones[0],
        sourceUrl,
      });
    }

    return leads;
  }

  /**
   * Parse table-based business listings (common in directory sites)
   */
  static parseTableFormat(html: string, sourceUrl: string): RawLead[] {
    const $ = cheerio.load(html);
    const leads: RawLead[] = [];

    $('table tbody tr').each((_index, element) => {
      try {
        const row = $(element);
        const cells = row.find('td');

        if (cells.length >= 2) {
          const businessName = cells.eq(0).text().trim();
          const phone = cells.eq(1).text().trim();
          const address = cells.eq(2)?.text().trim() || '';

          if (businessName) {
            leads.push({
              businessName,
              phone: phone || undefined,
              address: address || undefined,
              sourceUrl,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing table row:', error);
      }
    });

    return leads;
  }

  /**
   * Extract links that might be business websites
   */
  static extractBusinessLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a[href]').each((_index, element) => {
      const href = $(element).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        // Filter out social media and common non-business links
        if (!href.includes('facebook.com') && !href.includes('twitter.com')) {
          links.add(href);
        }
      }
    });

    return Array.from(links);
  }
}

export default LeadParser;
