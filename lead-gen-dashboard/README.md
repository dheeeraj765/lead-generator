<div align="center">

# 🎯 Lead Generator

**A full-stack SaaS lead generation dashboard — scrape, manage, and export business leads**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=for-the-badge&logo=postgresql)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)

[🌐 Live Demo](https://lead-generator-b81aeczj9-dheeeraj765s-projects.vercel.app) · [🐛 Report Bug](https://github.com/dheeeraj765/lead-generator/issues) · [✨ Request Feature](https://github.com/dheeeraj765/lead-generator/issues)

</div>

---

## 📸 Preview

| Login | Dashboard | Leads Table |
|-------|-----------|-------------|
| Clean auth UI with error handling | Scrape form + filters + pagination | Status tracking + CSV export |

---

## ✨ Features

- 🔐 **Custom Auth** — JWT session tokens signed with HMAC-SHA256, bcrypt password hashing, HTTP-only cookies
- 🔍 **Lead Scraping** — Search businesses by keyword + location using Foursquare Places API (free, great India coverage) with Nominatim OSM fallback
- 📊 **Dashboard** — Filter leads by name/status, paginated table, real-time updates
- 🏷️ **Status Tracking** — Mark leads as `NEW`, `CONTACTED`, or `IGNORED`
- 📤 **CSV Export** — Export filtered leads with one click
- 🗑️ **Lead Management** — Delete individual leads
- 🛡️ **Route Protection** — Edge middleware blocks unauthenticated access to dashboard
- 📱 **Responsive** — Works on desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework |
| **Language** | TypeScript 5 | Type safety throughout |
| **Styling** | Tailwind CSS 3 | Utility-first CSS |
| **Database** | PostgreSQL via Neon | Serverless Postgres |
| **ORM** | Prisma 6 | Type-safe DB queries |
| **Auth** | Custom JWT + bcryptjs | No NextAuth dependency |
| **Scraping** | Foursquare API + Nominatim | Business data sources |
| **Validation** | Zod | Runtime schema validation |
| **Deployment** | Vercel | Edge-optimized hosting |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database ([Neon free tier](https://neon.tech) recommended)
- Foursquare Developer account (free, 1000 calls/day)

### 1. Clone the repository

```bash
git clone https://github.com/dheeeraj765/lead-generator.git
cd lead-generator/lead-gen-dashboard
npm install
```

### 2. Set up environment variables

Create a `.env` file in `lead-gen-dashboard/`:

```env
# Database (use pooled URL for Vercel serverless)
DATABASE_URL="postgresql://user:password@host-pooler.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://user:password@host.region.aws.neon.tech/neondb?sslmode=require"

# Auth
SESSION_SECRET="your-super-secret-key-min-32-chars"

# Scraping (get free key at foursquare.com/developers)
FOURSQUARE_API_KEY="fsq3your_key_here"
```

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`. Create an account and start scraping!

---

## 📁 Project Structure

```
lead-gen-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/       # POST - authenticate user
│   │   │   ├── logout/      # POST - clear session cookie
│   │   │   ├── me/          # GET  - current user info
│   │   │   └── signup/      # POST - register new user
│   │   └── leads/
│   │       ├── [id]/        # PATCH/DELETE - update or delete lead
│   │       ├── export/      # GET  - download CSV
│   │       ├── scrape/      # POST - scrape new leads
│   │       └── route.ts     # GET  - list leads with filters
│   ├── components/
│   │   ├── FiltersBar.tsx   # Search + status filter + export button
│   │   ├── LeadsTable.tsx   # Paginated leads table
│   │   ├── NavBar.tsx       # Top navigation with user info
│   │   ├── ScrapeForm.tsx   # Keyword + location scrape form
│   │   └── StatusBadge.tsx  # Colored status indicator
│   ├── dashboard/           # Main protected dashboard page
│   ├── login/               # Sign in page
│   └── signup/              # Create account page
├── lib/
│   ├── auth.ts              # createSession, getUserFromSession, destroySession
│   ├── csv.ts               # CSV generation utility
│   ├── db.ts                # Prisma client singleton
│   ├── normalize.ts         # Phone/website/address normalizers
│   └── validators.ts        # Zod schemas for all API inputs
├── prisma/
│   ├── migrations/          # SQL migration history
│   └── schema.prisma        # User + Lead models
└── proxy.ts                 # Edge middleware for route protection
```

---

## 🗄️ Database Schema

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  leads        Lead[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Lead {
  id           String     @id @default(cuid())
  businessName String
  phone        String?
  website      String?
  address      String?
  sourceUrl    String
  keyword      String?
  location     String?
  status       LeadStatus @default(NEW)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  user         User       @relation(...)
}

enum LeadStatus { NEW  CONTACTED  IGNORED }
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- Sessions signed with **HMAC-SHA256** — tamper-proof
- Cookies are **HTTP-only** and **SameSite=lax** — no XSS access
- **Edge middleware** checks session cookie before page loads
- All DB queries are **user-scoped** — users never see each other's data
- All inputs validated with **Zod** before hitting the database

---

## 🌍 Deploying to Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Set root directory to `lead-gen-dashboard`
4. Add all environment variables in Vercel dashboard
5. Deploy — Prisma client is auto-generated via `postinstall`

> ⚠️ Use the **pooled** Neon connection URL for `DATABASE_URL` on Vercel to avoid serverless connection timeout issues.

---

## 🤝 Contributing

Contributions are welcome!

```bash
# Fork the repo, then:
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
# Open a Pull Request
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ by [Dheeraj Kashalkar](https://github.com/dheeeraj765)

⭐ Star this repo if you found it useful!

</div>