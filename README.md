# 🎯 Lead Generator

A modern, full-stack web application for scraping, managing, and exporting business leads with a beautiful UI/UX and powerful backend.

**Live Demo:** [https://lead-generator-omega-six.vercel.app](https://lead-generator-omega-six.vercel.app)

---

## ✨ Features

### Core Functionality
- **Lead Scraping** - Scrape business leads by keyword and location using real-time web scraping
- **Lead Management** - Organize leads with status tracking (New, Contacted, Ignored)
- **Advanced Search** - Filter leads by business name, email, phone, and more
- **CSV Export** - Export filtered leads to CSV for external use
- **Pagination** - Efficient data loading with 25 leads per page
- **Real-time Updates** - Instant feedback on scraping progress and status changes

### User Management
- **Authentication** - Secure signup and login with bcrypt password hashing
- **User Sessions** - Session-based authentication with secure cookies
- **Profile Management** - User profile display in dashboard

### UI/UX
- **Modern Design** - Professional gradient backgrounds and clean layouts
- **Dark Mode** - Full dark mode support across the entire application
- **Responsive Design** - Mobile, tablet, and desktop optimized
- **Smooth Animations** - Fade-in effects and loading spinners
- **Visual Feedback** - Clear success/error messages with icons
- **Professional Styling** - Consistent color scheme and spacing

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16.2.2
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **UI Component:** React 19.2.4
- **State Management:** React Hooks
- **Routing:** Next.js App Router

### Backend
- **Runtime:** Node.js
- **API:** Next.js API Routes
- **Database:** PostgreSQL (via Prisma)
- **ORM:** Prisma Client 6.19.3
- **Authentication:** NextAuth 5.0.0-beta.30
- **Password Hashing:** bcryptjs

### Web Scraping
- **Scraping:** Cheerio 1.2.0
- **HTTP Client:** Built-in Fetch API

### Other Tools
- **Validation:** Zod 4.3.6
- **Data Export:** CSV Stringify 6.7.0
- **Linting:** ESLint 9
- **Package Manager:** npm

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dheeeraj765/lead-generator.git
   cd lead-generator
   ```

2. **Navigate to the dashboard**
   ```bash
   cd lead-gen-dashboard
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Configure your database connection and authentication settings in `.env.local`

5. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production
```bash
npm run build
npm start
```

---

## 📋 Project Structure

```
lead-generator/
├── lead-gen-dashboard/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   └── signup/
│   │   │   └── leads/
│   │   │       ├── export/
│   │   │       ├── scrape/
│   │   │       └── [id]/
│   │   ├── components/
│   │   │   ├── FiltersBar.tsx
│   │   │   ├── LeadsTable.tsx
│   │   │   ├── NavBar.tsx
│   │   │   ├── ScrapeForm.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── csv.ts
│   │   ├── db.ts
│   │   ├── normalize.ts
│   │   ├── scraper.ts
│   │   └── validators.ts
│   ├── types/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.ts
└── LICENSE
```

---

## 🔑 Key Features Explained

### Lead Scraping
Users can search for business leads by entering:
- **Keyword** - Business type (e.g., "dentist", "plumber")
- **Location** - Geographic area (e.g., "Chicago, IL")
- **Limit** - Number of leads to scrape (1-100)

The scraper fetches data and automatically deduplicates leads.

### Lead Management
Once scraped, leads can be:
- **Viewed** - See full business details including website, phone, and address
- **Filtered** - Search by business name or filter by status
- **Updated** - Change lead status (New → Contacted → Ignored)
- **Deleted** - Remove leads from database
- **Exported** - Download as CSV file

### Authentication
- Users create an account with name, email, and password
- Passwords are securely hashed using bcryptjs
- Session-based authentication ensures user data privacy
- Each user only sees their own leads

---

## 🎨 Design Highlights

### Modern UI/UX
- **Gradient backgrounds** - Blue to indigo gradients for visual appeal
- **Card-based layout** - Clean, organized component structure
- **Rounded corners** - Modern 2xl border radius on major components
- **Shadow effects** - Depth with consistent shadow styling
- **Color coding** - Visual indicators for status (Blue: New, Green: Contacted, Gray: Ignored)

### Dark Mode
- Full dark mode support with slate color palette
- Automatic theme detection based on system preferences
- Smooth color transitions

### Responsive Design
- Mobile-first approach
- Breakpoints for sm, md, lg screens
- Touch-friendly button and input sizes

---

## 📊 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Leads
- `GET /api/leads` - Fetch user's leads (paginated)
- `GET /api/leads/[id]` - Get single lead
- `PATCH /api/leads/[id]` - Update lead status
- `DELETE /api/leads/[id]` - Delete lead
- `POST /api/leads/scrape` - Scrape new leads
- `GET /api/leads/export` - Export leads as CSV

---

## 🚢 Deployment

### Vercel (Recommended)
This project is optimized for Vercel deployment:

1. **Connect your GitHub repository to Vercel**
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Automatic deployment on push to main branch

### Live Application
🌐 **[https://lead-generator-omega-six.vercel.app](https://lead-generator-omega-six.vercel.app)**

---

## 🔐 Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **Session Management** - Secure session cookies
- **Input Validation** - Zod schema validation on all inputs
- **SQL Injection Prevention** - Prisma ORM protects against SQL injection
- **CSRF Protection** - Cookie-based security
- **Environment Variables** - Sensitive data stored in .env.local

---

## 📈 Performance Optimizations

- **Pagination** - Efficient data loading (25 leads per page)
- **Debounced Search** - 300ms debounce on search input
- **Optimistic Updates** - Instant UI feedback
- **CSS-in-JS** - Tailwind CSS for minimal bundle size
- **Next.js Optimization** - Automatic code splitting and lazy loading

---

## 🎯 Future Enhancements

- [ ] Email verification for signup
- [ ] Advanced filtering with date ranges
- [ ] Bulk lead actions
- [ ] Lead analytics dashboard
- [ ] API rate limiting
- [ ] Two-factor authentication
- [ ] Lead source tracking
- [ ] Custom scraping rules

---

## 📝 Environment Variables

Create a `.env.local` file in the `lead-gen-dashboard` directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lead_generator"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

---

## 🧪 Testing

Run the development server with hot reload:
```bash
npm run dev
```

Code linting:
```bash
npm run lint
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Dheeraj**
- GitHub: [@dheeeraj765](https://github.com/dheeeraj765)
- Repository: [lead-generator](https://github.com/dheeeraj765/lead-generator)

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For questions or issues, please open an issue on GitHub: [Issues](https://github.com/dheeeraj765/lead-generator/issues)

---

## 🏆 Key Achievements

✅ Full-stack web application built with modern technologies  
✅ Beautiful, responsive UI with dark mode support  
✅ Secure authentication system  
✅ Real-time data scraping and management  
✅ Professional code organization and structure  
✅ Deployed on Vercel with automatic CI/CD  
✅ Production-ready application  

---

**Made with ❤️ by Dheeraj**