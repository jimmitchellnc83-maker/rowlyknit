# Rowly - The Complete Knitting Project Management App 🧶

[![CI/CD Pipeline](https://github.com/jimmitchellnc83-maker/rowlyknit/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/jimmitchellnc83-maker/rowlyknit/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Production](https://img.shields.io/badge/production-rowlyknit.com-green)](https://rowlyknit.com)

Rowly is a production-ready, full-stack Progressive Web App for managing knitting projects, patterns, yarn stash, tools, and more. Built with modern technologies and designed for knitters who want to track multiple projects simultaneously with offline support.

## ✨ Key Features

- **Project Management** - Track multiple knitting projects with photos, notes, and progress
- **Row/Stitch Counters** - Multiple counters per project with history and undo
- **Pattern Library** - Upload and organize PDF patterns with full-featured viewer
- **Yarn Stash Management** - Comprehensive inventory with photos and usage tracking
- **Tool Tracker** - Manage needles, hooks, and accessories
- **Offline Support** - Service workers and IndexedDB for full offline functionality
- **Progressive Web App** - Install on mobile devices like a native app
- **Dark Mode** - Full dark mode support with system preference detection

## 🏗️ Technology Stack

**Backend:** Node.js 18 + Express + TypeScript + PostgreSQL 16 + Redis 7
**Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Zustand + React Query
**Infrastructure:** Docker + Nginx + Let's Encrypt + Digital Ocean + Cloudflare
**Security:** JWT authentication, rate limiting, CSRF protection, security headers (Helmet.js)

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git
cd rowlyknit

# Backend setup
cd backend
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev

# Frontend setup (in new terminal)
cd frontend
npm install
npm run dev
```

**Access:** Frontend at `http://localhost:3000` | Backend API at `http://localhost:5000`

### Docker Development

```bash
docker-compose up -d
```

## 📚 Documentation

- **[Getting Started](docs/getting-started/)** - Setup guides, codebase analysis, demo guide
- **[Deployment](docs/deployment/)** - Production deployment and troubleshooting
- **[Features](docs/features/)** - Implemented features and integration roadmap
- **[Security](docs/security/)** - Security audit reports and best practices
- **[API Reference](docs/api/)** - API documentation and examples

### Quick Links

- 📖 [Codebase Analysis](docs/getting-started/CODEBASE_ANALYSIS.md)
- 🚀 [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)
- 🛠️ [Troubleshooting](docs/deployment/TROUBLESHOOTING.md)
- ✅ [Features Complete](docs/features/FEATURES_COMPLETE.md)
- 🔒 [Security Audit](docs/security/SECURITY_AUDIT_FINAL_2025.md)

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## 📦 Production Deployment

**Quick Reference:**
- 📋 [Production Deployment Status](PRODUCTION_DEPLOYMENT_STATUS.md) - Current status and setup guide
- ⚡ [Production Quick Reference](PRODUCTION_QUICK_REFERENCE.md) - Command cheat sheet

**Deploy to Production:**
```bash
# SSH to production server
ssh root@rowlyknit-production

# Navigate to app directory (IMPORTANT!)
cd /home/user/rowlyknit

# Run deployment script
bash scripts/deployment/DEPLOY_TO_PRODUCTION_NOW.sh
```

For detailed deployment instructions, see [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)

## 🗄️ Database Management

```bash
# Run migrations
cd backend
npm run migrate

# Seed sample data
npm run seed

# Create backup
docker-compose exec postgres pg_dump -U rowly_user rowly_production > backup.sql
```

## 🔒 Security Features

- JWT with rotating tokens and HttpOnly cookies
- Rate limiting (Redis-based): 5 req/min for auth, 100 req/min for API
- CSRF protection with double-submit cookies
- Security headers: CSP, HSTS, X-Frame-Options
- Input sanitization and validation (Zod)
- SQL injection prevention (parameterized queries)
- GDPR compliance with data export/deletion

## 📊 Performance & Monitoring

**Performance Targets:**
- API Response Time: 95% < 200ms, 99% < 500ms
- Page Load Time: < 3 seconds on 3G
- Uptime: 99.9% availability

**Monitoring:**
```bash
# View logs
docker-compose logs -f backend

# Health checks
curl https://rowlyknit.com/health

# Metrics
curl https://rowlyknit.com/metrics
```

## 🌐 API Documentation

Full API documentation available at: https://rowlyknit.com/api-docs

**Key Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/projects` - List all projects
- `GET /api/patterns` - List patterns
- `GET /api/yarn` - List yarn stash

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🎯 Roadmap

- [ ] Mobile apps (React Native)
- [ ] Social features (share projects)
- [ ] AI pattern suggestions
- [ ] Video tutorials integration
- [ ] Multi-language support
- [ ] Marketplace for patterns

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/jimmitchellnc83-maker/rowlyknit/issues)
- **Email**: support@rowlyknit.com

---

**Demo Account**
Email: demo@rowlyknit.com | Password: Demo123!@#

**Production URL**: https://rowlyknit.com
**Server IP**: 165.227.97.4

Made with ❤️ and 🧶 by knitters, for knitters.
