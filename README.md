# Rowly - The Complete Knitting Project Management App 🧶

[![CI/CD Pipeline](https://github.com/jimmitchellnc83-maker/rowlyknit/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/jimmitchellnc83-maker/rowlyknit/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Production](https://img.shields.io/badge/production-rowlyknit.com-green)](https://rowlyknit.com)

Rowly is a production-ready, full-stack web application for managing knitting projects, patterns, yarn stash, tools, and more. Built with modern technologies and designed for knitters who want to track multiple projects simultaneously.

## ✨ Features

### Core Functionality
- **Project Management**: Track multiple knitting projects with photos, notes, and progress
- **Row/Stitch Counters**: Multiple counters per project with history and undo functionality
- **Pattern Library**: Upload and organize PDF patterns with full-text search
- **Yarn Stash**: Comprehensive inventory management with photos and usage tracking
- **Tool Tracker**: Manage needles, hooks, and accessories
- **Recipient Profiles**: Track measurements and gift history

### Technical Features
- **Offline Support**: Service workers and IndexedDB for offline functionality
- **Progressive Web App**: Install on mobile devices like a native app
- **Real-time Sync**: Automatic synchronization when online
- **Responsive Design**: Mobile-first, touch-friendly interface (44px+ touch targets)
- **Dark Mode**: Full dark mode support
- **Accessibility**: WCAG 2.1 AA compliant with ARIA labels

### Security & Compliance
- **JWT Authentication**: Secure, rotating tokens with HttpOnly cookies
- **Rate Limiting**: Redis-based protection against abuse
- **GDPR Compliant**: Data export, deletion, and consent management
- **Security Headers**: Helmet.js with CSP, HSTS, and more
- **Input Validation**: Comprehensive sanitization and validation
- **SSL/TLS**: Let's Encrypt certificates with automatic renewal

### Production Features
- **Monitoring**: Structured logging with Winston, error tracking
- **Metrics**: Prometheus-compatible metrics endpoint
- **Automated Backups**: Hourly database backups with 30-day retention
- **Health Checks**: Liveness and readiness probes
- **Zero-Downtime Deployment**: Docker-based blue-green deployment
- **CI/CD**: Automated testing, security scanning, and deployment

## 🔒 Security Setup

**Never commit** `.env.production` or `PRODUCTION_SECRETS.env` to version control. These files are blocked by `.gitignore`.

### Setting Up Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env.production
   ```

2. Generate secrets for each `CHANGE_ME` placeholder:
   ```bash
   # Generate a secure random secret (use for JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET, CSRF_SECRET)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # Generate a secure random password (use for DB_PASSWORD, REDIS_PASSWORD)
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

3. Fill in all remaining values (API keys, domain names, etc.) and deploy the `.env.production` file to your server **outside of git** (e.g., via SSH, secrets manager, or CI/CD environment variables).

### What if secrets are accidentally committed?

1. **Rotate immediately** — assume any committed secret is compromised.
2. Replace the file contents with `# This file is not stored in git. See .env.example`
3. Commit the replacement and force-push if needed.
4. Verify `.gitignore` blocks the file from future commits.

### Pre-commit secret scanning (optional, recommended)

CI runs `gitleaks` on every PR and push to `main` (see `.github/workflows/secret-scan.yml`). To catch leaks locally **before** you push, enable the same check as a git hook:

```bash
pip install pre-commit     # or: brew install pre-commit
pre-commit install         # wires .git/hooks/pre-commit to .pre-commit-config.yaml
```

From then on, every `git commit` runs `gitleaks protect --staged` and blocks the commit if it finds a secret. To run it once across staged files without committing: `pre-commit run gitleaks`.

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js 18+ with Express
- PostgreSQL 16 (database)
- Redis 7 (caching, rate limiting)
- TypeScript
- Knex.js (migrations, query builder)

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Query (data fetching)
- Zustand (state management)
- Service Workers (offline support)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Let's Encrypt (SSL/TLS)
- Digital Ocean (hosting)
- Cloudflare (CDN, DNS)
- GitHub Actions (CI/CD)

### System Architecture

```
┌─────────────┐
│  Cloudflare │ (CDN, DNS, DDoS protection)
└──────┬──────┘
       │
┌──────▼──────┐
│    Nginx    │ (Reverse proxy, SSL termination)
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
│  Frontend   │ │ Backend  │ │ Static     │
│  (React)    │ │ (Node.js)│ │ Files      │
└─────────────┘ └────┬─────┘ └────────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
      ┌────▼─────┐      ┌─────▼────┐
      │PostgreSQL│      │  Redis   │
      └──────────┘      └──────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git
cd rowlyknit
```

2. **Backend setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run migrate
npm run seed
npm run dev
```

3. **Frontend setup**
```bash
cd frontend
npm install
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Documentation: http://localhost:5000/api

### Docker Development

```bash
docker-compose up -d
```

## 📦 Production Deployment

### Digital Ocean Server Setup

1. **Initial server configuration**
```bash
ssh root@165.227.97.4
cd /home/user/rowlyknit/deployment/scripts
chmod +x server-setup.sh
./server-setup.sh
```

2. **Configure environment variables**
```bash
cd /home/user/rowlyknit/backend
cp .env.example .env
nano .env  # Edit with production values
```

3. **Setup SSL certificates**
```bash
cd /home/user/rowlyknit/deployment/scripts
chmod +x setup-ssl.sh
./setup-ssl.sh
```

4. **Deploy application**
```bash
chmod +x deploy.sh
./deploy.sh
```

5. **Enable systemd service**
```bash
systemctl enable rowly
systemctl start rowly
systemctl status rowly
```

### Environment Variables

See [backend/.env.example](backend/.env.example) for all required environment variables.

Critical production variables:
- `JWT_SECRET`: 32+ character random string
- `DB_PASSWORD`: Strong database password
- `REDIS_PASSWORD`: Redis password
- `EMAIL_API_KEY`: Email service API key

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Frontend Tests
```bash
cd frontend
npm test                # Run all tests
npm run test:ui         # UI mode with Vitest
```

### E2E Tests
```bash
npm run test:e2e
```

## 📊 Monitoring & Logs

### View Application Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Prometheus Metrics
```
http://localhost:9090/metrics
```

### Health Checks
- Backend: https://rowlyknit.com/health
- Database: Check PostgreSQL container health
- Redis: Check Redis container health

## 🔒 Security

### Security Features
- JWT with rotating tokens
- HttpOnly, Secure, SameSite cookies
- CSRF protection
- Rate limiting (5 req/min for auth, 100 req/min for API)
- Input sanitization and validation
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- SQL injection prevention (parameterized queries)
- XSS protection

### Security Scanning
```bash
npm audit                        # Check dependencies
docker run --rm -v $(pwd):/code aquasecurity/trivy fs /code  # Vulnerability scanning
```

## 📈 Performance

### Performance Targets (SLOs)
- **API Response Time**: 95% < 200ms, 99% < 500ms
- **Page Load Time**: < 3 seconds on 3G
- **Uptime**: 99.9% availability
- **Error Rate**: < 0.1% for 5xx errors

### Optimization Features
- Code splitting and lazy loading
- Image compression and thumbnails
- CDN caching (Cloudflare)
- Database indexes on frequently queried fields
- Redis caching for rate limiting and sessions
- Gzip/Brotli compression

## 🗄️ Database

### Run Migrations
```bash
cd backend
npm run migrate              # Run all migrations
npm run migrate:rollback     # Rollback last migration
```

### Seed Sample Data
```bash
npm run seed
```

### Manual Backup
```bash
docker-compose exec postgres pg_dump -U rowly_user rowly_production > backup.sql
```

### Restore Backup
```bash
docker-compose exec -T postgres psql -U rowly_user rowly_production < backup.sql
```

## 🌐 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user profile

### Project Endpoints
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

Full API documentation: https://rowlyknit.com/api-docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/jimmitchellnc83-maker/rowlyknit/issues)
- **Email**: support@rowlyknit.com

## 🎯 Roadmap

- [ ] Mobile apps (React Native)
- [ ] Social features (share projects)
- [ ] AI pattern suggestions
- [ ] Video tutorials integration
- [ ] Multi-language support
- [ ] Marketplace for patterns

## 📸 Screenshots

Coming soon!

## 🙏 Acknowledgments

- Knitting community for feature suggestions
- Open source contributors
- Digital Ocean for hosting

---

**Production URL**: https://rowlyknit.com

Made with ❤️ and 🧶 by knitters, for knitters.
