# 🚀 Web Scraping Pipeline - Complete Implementation Guide

## Overview

This is a **production-ready, modular web scraping pipeline** designed to collect business lead data from web directories (like Justdial) and integrate it into your AI-powered lead generation system.

The pipeline is built with:
- ✅ **TypeScript** for type safety
- ✅ **Puppeteer** for dynamic content scraping
- ✅ **Stealth plugins** to avoid bot detection
- ✅ **Modular architecture** for maintainability
- ✅ **Error handling & rate limiting** for robustness
- ✅ **Multi-stage filtering** (parsing → normalization → deduplication → validation)

---

## 📁 Project Structure

```
lib/scrapers/
├── parser.ts              # HTML parsing & data extraction
├── normalizer.ts          # Data cleaning & standardization
├── deduplicator.ts        # Remove duplicate leads
├── validator.ts           # Quality checking & filtering
├── puppeteer-scraper.ts   # Web scraping with Puppeteer
└── orchestrator.ts        # Main pipeline coordinator

app/api/leads/
└── scrape/
    └── route.ts           # REST API endpoint for scraping
```

---

## 🔄 Pipeline Flow

```
┌─────────────────┐
│   User Input    │  keyword, location, limit
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  1. WEB SCRAPER          │  Puppeteer + Stealth → Raw HTML
│  (puppeteer-scraper.ts)  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  2. PARSER               │  Extract structured data from HTML
│  (parser.ts)             │  → RawLead objects
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  3. NORMALIZER           │  Clean & standardize fields
│  (normalizer.ts)         │  → NormalizedLead objects
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  4. DEDUPLICATOR         │  Remove duplicate leads
│  (deduplicator.ts)       │  (exact match, phone, name fuzzy)
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  5. VALIDATOR            │  Quality scoring & filtering
│  (validator.ts)          │  → Final high-quality leads
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  6. DATABASE             │  Store validated leads
│  (Prisma)                │  in PostgreSQL
└──────────────────────────┘
```

---

## 📦 Module Details

### 1. **Parser Module** (`parser.ts`)

Extracts structured business data from HTML.

**Key Functions:**
- `parseLeadsList()` - Generic parser using CSS selectors
- `parseJustdial()` - Justdial-specific parsing
- `parseTableFormat()` - Parse table-based listings
- `extractBusinessLinks()` - Extract all business URLs

**Example:**
```typescript
const leads = LeadParser.parseJustdial(html, sourceUrl);
// Returns: RawLead[] with businessName, phone, address, website
```

---

### 2. **Normalizer Module** (`normalizer.ts`)

Cleans and standardizes data fields.

**Functions:**
- `normalizePhoneNumber()` - Converts to international format (+91-XXXXXXXXXX)
- `normalizeBusinessName()` - Capitalize, remove junk patterns
- `normalizeAddress()` - Clean whitespace, standardize punctuation
- `normalizeWebsite()` - Add protocol, validate URL format
- `normalizeLead()` - Normalize all fields in a lead
- `calculateSimilarity()` - Levenshtein distance-based string matching

**Example:**
```typescript
const lead = normalizeLead({
  businessName: "  dr. smith dental clinic  ",
  phone: "09876543210",
  address: "123 Main Street, Delhi",
  website: "drsmith.com"
});
// Returns standardized lead with +91 phone format, proper capitalization
```

---

### 3. **Deduplicator Module** (`deduplicator.ts`)

Removes duplicate leads using multiple strategies.

**Matching Strategies:**
1. **Exact signature match** - businessName + phone + address
2. **Phone match** - Same phone number (highest confidence)
3. **Website match** - Same website URL
4. **Fuzzy name match** - Similar business names (similarity score ≥ 0.85)

**Functions:**
- `deduplicateLeads()` - Remove duplicates from a list
- `findDuplicateMatches()` - Compare against existing database
- `getDuplicateStats()` - Get deduplication statistics

**Example:**
```typescript
const unique = deduplicateLeads(leads, {
  nameSimilarityThreshold: 0.85,
  removeDuplicates: true
});
```

---

### 4. **Validator Module** (`validator.ts`)

Validates lead quality and filters low-quality data.

**Validation Checks:**
- Business name exists and is valid
- Phone number format is correct (10-15 digits)
- Address is reasonable length
- Website URL is valid
- No junk/test patterns in names
- Quality score calculation (0-100)

**Functions:**
- `validateLead()` - Validate single lead with error/warning details
- `filterLeadsByQuality()` - Filter by quality score
- `calculateQualityMetrics()` - Get overall pipeline metrics

**Example:**
```typescript
const results = filterLeadsByQuality(leads, {
  minQualityScore: 60,
  requirePhone: true,
  requireAddress: false
});
```

---

### 5. **Puppeteer Scraper Module** (`puppeteer-scraper.ts`)

Handles web scraping with anti-detection measures.

**Key Features:**
- ✅ **Stealth mode** - Avoid being detected as bot
- ✅ **Rate limiting** - Configurable delays between requests
- ✅ **Retry logic** - Automatic retries on failure
- ✅ **Dynamic content handling** - Wait for JS-rendered content
- ✅ **Error handling** - Comprehensive error logging
- ✅ **User agent rotation** - Realistic browser headers

**Configuration:**
```typescript
const scraper = new WebScraper({
  headless: true,
  timeout: 30000,           // 30 seconds per page
  delayBetweenRequests: 2000, // 2 seconds between requests
  maxRetries: 3,
  userAgent: '...'
});
```

**Functions:**
- `initialize()` - Start browser
- `scrapePage()` - Scrape single page with retries
- `scrapePages()` - Scrape multiple pages with rate limiting
- `searchAndScrape()` - Search and scrape results
- `checkUrlAccessibility()` - Test if URL is reachable
- `takeScreenshot()` - Debug screenshots

**Example:**
```typescript
await scraper.initialize();
const page = await scraper.scrapePage('https://example.com/search');
const pages = await scraper.scrapePages(urls);
await scraper.close();
```

---

### 6. **Orchestrator Module** (`orchestrator.ts`)

Coordinates the entire pipeline - brings all modules together.

**Main Function:**
```typescript
async scrapeLeads(options: ScrapeOptions): Promise<ScrapedLead[]>
```

**Process:**
1. Initialize Puppeteer browser
2. Scrape target pages
3. Parse HTML → Extract raw leads
4. Normalize data
5. Deduplicate
6. Validate quality
7. Return final leads

**Statistics Tracking:**
- Pages scraped
- Raw leads extracted
- Leads after each processing stage
- Quality scores
- Pipeline efficiency percentage

**Example:**
```typescript
const orchestrator = new LeadScrapeOrchestrator();
const leads = await orchestrator.scrapeLeads({
  keyword: 'dentist',
  location: 'Kolhapur',
  limit: 50,
  mindQualityScore: 60
});
const stats = orchestrator.getStats();
```

---

## 🌐 API Usage

### Endpoint: `POST /api/leads/scrape`

**Authentication:** Required (Next-Auth session)

**Request Body:**
```json
{
  "keyword": "dentist",
  "location": "Kolhapur",
  "limit": 50,
  "minQualityScore": 60,
  "requirePhone": true,
  "requireAddress": false
}
```

**Response:**
```json
{
  "success": true,
  "inserted": 42,
  "duplicatesSkipped": 3,
  "leads": [
    {
      "businessName": "Dr. Smith Dental Clinic",
      "phone": "+91-9876543210",
      "address": "123 Main Street, Kolhapur",
      "website": "https://drsmith-clinic.com",
      "sourceUrl": "https://justdial.com/...",
      "keyword": "dentist",
      "location": "Kolhapur"
    }
  ],
  "stats": {
    "duration": 45000,
    "pagesScraped": 5,
    "rawLeadsExtracted": 150,
    "leadsAfterNormalization": 145,
    "leadsAfterDeduplication": 142,
    "validLeadsCount": 42,
    "averageQualityScore": 72.5,
    "pipelineEfficiency": 28.0
  }
}
```

---

## 💻 Programmatic Usage

### Basic Example: Scrape dentists in Kolhapur

```typescript
import LeadScrapeOrchestrator from '@/lib/scrapers/orchestrator';

const orchestrator = new LeadScrapeOrchestrator({
  headless: true,
  timeout: 60000,
  delayBetweenRequests: 2000,
  maxRetries: 2,
});

const leads = await orchestrator.scrapeLeads({
  keyword: 'dentist',
  location: 'Kolhapur',
  limit: 20,
  mindQualityScore: 50,
  requirePhone: true,
  requireAddress: false,
});

console.log(`Found ${leads.length} qualified leads`);
leads.forEach(lead => {
  console.log(`${lead.businessName}: ${lead.phone}`);
});

const stats = orchestrator.getStats();
console.log(`Pipeline efficiency: ${stats.pipelineEfficiency.toFixed(1)}%`);
```

### Advanced Example: Custom filtering

```typescript
import { LeadParser } from '@/lib/scrapers/parser';
import { normalizeLead } from '@/lib/scrapers/normalizer';
import { deduplicateLeads } from '@/lib/scrapers/deduplicator';
import { validateLead, filterLeadsByQuality } from '@/lib/scrapers/validator';

// 1. Parse HTML manually
const rawLeads = LeadParser.parseJustdial(html, sourceUrl);

// 2. Normalize each lead
const normalized = rawLeads
  .map(lead => normalizeLead(lead))
  .filter(l => l !== null);

// 3. Deduplicate
const unique = deduplicateLeads(normalized);

// 4. Validate and filter
const qualified = filterLeadsByQuality(unique, {
  minQualityScore: 75,
  requirePhone: true,
  requireAddress: true,
});

// 5. Use results
qualified.forEach(({ lead, score }) => {
  console.log(`${lead.businessName} (score: ${score})`);
});
```

---

## 🛡️ Anti-Detection & Rate Limiting

### How to Avoid Being Blocked

1. **Stealth Mode** - Hides automation signals
   ```typescript
   // Automatically enabled via puppeteer-extra-plugin-stealth
   ```

2. **Rate Limiting** - Delays between requests
   ```typescript
   const scraper = new WebScraper({
     delayBetweenRequests: 2000  // 2 seconds between requests
   });
   ```

3. **Realistic Headers** - Browser-like user agents and headers
   ```typescript
   // Automatically set in WS.scrapePage()
   ```

4. **Retry Logic** - Exponential backoff on failure
   ```typescript
   {
     delayBetweenRequests: 2000 * (currentRetry + 1)
   }
   ```

5. **Dynamic Content Handling** - Wait for JS rendering
   ```typescript
   // Automatically handled in waitForDynamicContent()
   ```

---

## 🚀 Performance & Scalability

### Estimated Performance

| Metric | Value |
|--------|-------|
| Scrape Speed | 3-5 pages/min (with 2s delay) |
| Data Extraction | 10-50 leads per page |
| Pipeline Efficiency | 20-40% (raw → final) |
| Quality Scoring | ~200ms per 100 leads |
| Deduplication | ~50ms per 100 leads |

### For Better Performance:

1. **Parallel Scraping** - Use worker threads
   ```typescript
   // TODO: Implement in future versions
   ```

2. **Caching** - Cache parsed results
   ```typescript
   // Store in Redis for reuse
   ```

3. **Batch Processing** - Process multiple searches concurrently
   ```typescript
   // Limit concurrent browsers to avoid resource exhaustion
   ```

4. **ML Scoring** - Replace validator with ML model
   ```typescript
   // Next feature: Lead scoring with ML
   ```

---

## 🔮 Future Enhancements

1. **Machine Learning Scoring**
   - Replace rule-based validation with ML model
   - Train on user interactions (qualified/ignored)
   - Continuous learning

2. **Portal Integrations**
   - Justdial SDK for official data
   - Yellow Pages API integration
   - Google Maps API for verification

3. **Advanced Deduplication**
   - Vector embedding similarity
   - Phone number format variations
   - Business name aliases

4. **Distributed Scraping**
   - Worker queue system
   - Multi-region support
   - Load balancing

5. **Lead Enrichment**
   - Company size estimation
   - Revenue prediction
   - Industry classification

---

## 📋 Troubleshooting

### Issue: Getting blocked by websites

**Solution:**
- Increase `delayBetweenRequests` to 5000ms
- Randomize delays: `delay = 2000 + Math.random() * 3000`
- Use residential proxies (future enhancement)

### Issue: HTML parsing not working

**Solution:**
- Check website structure hasn't changed
- Update CSS selectors in `parser.ts`
- Use browser console to find correct selectors
- Take screenshot for debugging: `await scraper.takeScreenshot(url, 'debug.png')`

### Issue: Low pipeline efficiency

**Solution:**
- Adjust `minQualityScore` threshold
- Relax validation rules for specific fields
- Check if parser is missing data
- Improve normalizer for edge cases

### Issue: Browser crashes

**Solution:**
- Check available system memory
- Reduce concurrent requests
- Increase timeout values
- Use `--disable-dev-shm-usage` flag (already enabled)

---

## 📚 Database Schema

The scraped leads are stored using Prisma:

```prisma
model Lead {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  businessName String
  website      String?
  phone        String?
  address      String?
  sourceUrl    String
  keyword      String?
  location     String?
  status       LeadStatus @default(NEW)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([userId, status])
  @@index([userId, businessName])
  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, website])
  @@index([userId, phone])
}

enum LeadStatus {
  NEW
  CONTACTED
  IGNORED
}
```

---

## 🎯 Production Deployment

### Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Optional: Proxy settings
PROXY_URL=
```

### Docker Deployment

For Puppeteer to work in Docker:

```dockerfile
FROM node:18-alpine

# Install Chromium
RUN apk add --no-cache \
  chromium \
  noto-sans

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

CMD ["npm", "start"]
```

### Performance Tuning

1. **Memory limits** - Set max heap size
2. **Concurrency** - Limit parallel operations
3. **Timeouts** - Adjust based on target sites
4. **Rate limiting** - Comply with sites' robots.txt

---

## 📞 Example: Scraping Dentists in Kolhapur

**Call the API:**
```bash
curl -X POST http://localhost:3000/api/leads/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "dentist",
    "location": "Kolhapur",
    "limit": 50,
    "minQualityScore": 60,
    "requirePhone": true
  }'
```

**Expected Result:**
- 5-10 qualified dentist leads
- With phone numbers and addresses
- Stored in your PostgreSQL database
- Quality score ≥ 60/100

---

## 🎓 Learning Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [Puppeteer-Extra Stealth Plugin](https://github.com/berstend/puppeteer-extra)
- [Web Scraping Best Practices](https://www.oreilly.com/library/view/web-scraping/9781491985564/)
- [Levenshtein Distance Algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance)

---

## ⚖️ Legal & Ethical Considerations

✅ **Do:**
- Respect robots.txt
- Add delays between requests
- Check website's ToS
- Cache results to reduce requests
- Use scraped data ethically

❌ **Don't:**
- Bypass CAPTCHA or authentication
- Ignore rate limits
- Scrape protected content
- Resell data without permission

---

## 📝 License

This scraping system is part of the Lead Generator project. Follow the main LICENSE.

---

**Built with ❤️ for production-grade lead generation**
