# 🛰️ Scraping in Different Environments - Setup Guide

## Problem

Puppeteer (browser automation) requires a Chromium/Chrome instance, which is **NOT available on Vercel serverless** by default. This causes `500` errors when trying to use the `/api/leads/scrape` endpoint on Vercel.

---

## Solutions

### ✅ Solution 1: Run Locally (Development)

**Best for testing and development**

The scraping system works perfectly locally because your machine has a full OS with browser support.

```bash
# Clone and setup
git clone https://github.com/dheeeraj765/lead-generator.git
cd lead-generator/lead-gen-dashboard

# Install dependencies
npm install

# Run development server
npm run dev

# Now you can test scraping at: http://localhost:3000/api/leads/scrape
```

**To scrape from the UI:**
1. Go to http://localhost:3000/dashboard
2. Enter keyword (e.g., "dentist")
3. Enter location (e.g., "Kolhapur")
4. Click "Start Scraping"
5. Works perfectly! ✅

---

### ✅ Solution 2: Use a Scraping API Service (Recommended for Production)

**Best for serverless (Vercel, AWS Lambda, etc.)**

Instead of using Puppeteer, use a third-party scraping API:

#### Option A: **Firecrawl** (Recommended)
- URL: https://www.firecrawl.dev
- Perfect for web scraping
- Serverless-friendly
- Free tier available

**Implementation:**
```typescript
// lib/scrapers/firecrawl-scraper.ts
import FirecrawlApp from "@firecrawl/app";

export async function scrapeWithFirecrawl(url: string) {
  const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
  });

  const scrapeResult = await app.scrapeUrl(url, {
    formats: ["html"],
  });

  return scrapeResult.html;
}
```

#### Option B: **ScraperAPI**
- URL: https://www.scraperapi.com
- Works with any website
- Handles proxies and retries

#### Option C: **Apify**
- URL: https://apify.com
- Powerful actor framework
- Built-in integrations

---

### ✅ Solution 3: Add Chromium Package to Vercel

**For Node.js serverless environments**

1. Install `chromium-browser-snapshots`:
```bash
npm install chromium-browser-snapshots
```

2. Update puppeteer config:
```typescript
const extra = require('puppeteer-extra');

this.browser = await extra.launch({
  headless: true,
  executablePath: '/opt/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

3. Add to `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "env": {
    "PUPPETEER_CACHE_DIR": "/tmp/chromium"
  }
}
```

**Limitations:** This works but may take the Vercel function over 12-second limit.

---

### ✅ Solution 4: Docker + Cloud Deployment

**Best for complete control**

Deploy to environments that support Docker and have persistent resources:

- **Railway** (https://railway.app) - $5/month starter plan
- **Render** (https://render.com) - Free tier
- **AWS EC2** - More expensive but powerful
- **DigitalOcean** - $5-6/month droplet

**Dockerfile example:**
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache chromium

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

CMD ["npm", "start"]
```

---

## Recommended Setup by Use Case

| Use Case | Solution | Pros | Cons |
|----------|----------|------|------|
| **Development/Testing** | Run Locally | Works perfectly | Laptop only |
| **Production MVP** | Firecrawl API | Serverless, reliable | $25-100/month |
| **Production Scale** | Docker + Railway | Scalable, full control | More setup required |
| **Quick Cloud Test** | Railway + Docker | Easy deployment | Moderate cost |

---

## Implementation: Switch to Firecrawl (Quickest Fix for Vercel)

### Step 1: Get Firecrawl API Key
1. Go to https://www.firecrawl.dev
2. Sign up (free tier available)
3. Copy API key

### Step 2: Update Environment
```bash
# .env.local
FIRECRAWL_API_KEY=your_api_key_here
```

### Step 3: Create Firecrawl Scraper
```typescript
// lib/scrapers/firecrawl-adapter.ts
import FirecrawlApp from "@firecrawl/app";
import { LeadParser } from "./parser";

export async function scrapeWithFirecrawl(url: string) {
  const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
  });

  try {
    const scrapeResult = await app.scrapeUrl(url, {
      formats: ["html"],
      timeout: 30000,
    });

    return scrapeResult.html;
  } catch (error) {
    console.error("Firecrawl error:", error);
    throw error;
  }
}
```

### Step 4: Update Orchestrator
```typescript
// lib/scrapers/orchestrator.ts
import { scrapeWithFirecrawl } from "./firecrawl-adapter";

private async scrapePages(options: ScrapeOptions): Promise<ScrapedPage[]> {
  // Use Firecrawl instead of Puppeteer
  const html = await scrapeWithFirecrawl(searchUrl);
  
  return [{
    url: searchUrl,
    html,
    title: "Search Results"
  }];
}
```

### Step 5: Update API Route
```typescript
// app/api/leads/scrape/route.ts
// No changes needed - orchestrator handles it
```

---

## For Now: Local Development Usage

**Your scraping system works perfectly locally!**

### Quick Start:
```bash
cd lead-generator/lead-gen-dashboard
npm install
npm run dev
```

Then visit: http://localhost:3000

### Test the Scraping:
1. Go to Dashboard tab
2. Enter search criteria
3. Click "Start Scraping"
4. Works! ✅

---

## Next Steps

### Short Term:
- ✅ Use scraping system locally for development
- ✅ Test with real Justdial/similar websites
- ✅ Verify data quality and pipeline efficiency

### Medium Term:
- 🔄 Integrate Firecrawl or similar API
- 🔄 Update orchestrator to use API instead of Puppeteer
- 🔄 Deploy to Vercel (will work with API service)

### Long Term:
- 🎯 Consider Docker deployment with Railway/Render
- 🎯 Build ML scoring layer on top
- 🎯 Scale to handle 1000s of queries

---

## FAQ

**Q: Why doesn't it work on Vercel?**
A: Vercel's serverless functions don't have browser binaries. They're designed for stateless APIs, not resource-heavy processes.

**Q: Is there a free solution?**
A: Yes! Firecrawl has a free tier (~100 requests/month). Or run locally.

**Q: Can I use a different scraping library?**
A: Yes! Consider:
- Cheerio (lightweight, no browser) - for static HTML
- Playwright (similar to Puppeteer)
- Selenium (older but reliable)
- Request-HTML library

**Q: Will upgrading Vercel plan help?**
A: No. The limitation is architectural (serverless = no browsers). Premium Vercel doesn't change this.

**Q: How much does Firecrawl cost?**
A: Free tier: 100 requests/month. Paid: $25-500/month depending on volume.

---

## Resources

- [Puppeteer Official Docs](https://pptr.dev/)
- [Firecrawl Documentation](https://www.firecrawl.dev/docs)
- [Vercel Edge Functions](https://vercel.com/docs/functions)
- [Railway Deployment](https://docs.railway.app/)
- [Docker for Deployment](https://docs.docker.com/)

---

## Still Have Questions?

1. **Local testing not working?** - Run `npm install` to verify dependencies
2. **404 errors?** - Check that `/api/leads/scrape` is defined
3. **Timeout errors?** - Increase timeout in orchestrator config
4. **Rate limiting?** - Target website might be blocking requests

---

**Summary**: Your scraping system is production-ready for local/Docker environments. For Vercel, integrate a scraping API service like Firecrawl for best results.
