# 🎮 Rowly Demo Guide

## Quick Demo (Frontend Only - Currently Running!)

The frontend development server is now running at:

**URL:** http://localhost:3000/

### What You Can Test (Frontend UI)

✅ **Visual Features:**
- Responsive design and layouts
- Dark mode toggle (moon/sun icon in header)
- Navigation and routing
- PWA features (try installing as app)
- Service worker and offline indicators
- All page layouts and components

⚠️ **Note:** The backend API is not running, so:
- Login/registration won't work (API calls will fail)
- Data won't persist
- File uploads won't work

This is perfect for testing the **UI/UX and frontend functionality**.

---

## Full Local Demo (With Backend + Database)

For a complete demo with working authentication and data persistence, you'll need Docker on your local machine.

### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM available

### Steps for Full Demo

1. **On your local machine (not in this environment):**

```bash
# Clone the repository
git clone https://github.com/jimmitchellnc83-maker/rowlyknit.git
cd rowlyknit
git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy

# Create environment file for local testing
cd backend
cp .env.example .env.local
nano .env.local
```

2. **Update `.env.local` for local development:**

```env
# Change these for local testing:
NODE_ENV=development
APP_URL=http://localhost:3000
DB_HOST=localhost
DB_PASSWORD=your_local_password
REDIS_HOST=localhost
REDIS_PASSWORD=your_local_redis_password
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:3000

# Keep the secure secrets from production .env
JWT_SECRET=B38SCZz8G7PWXtgQWhClIZ4ea4d6vyYNteQkh3EKToo=
JWT_REFRESH_SECRET=ipqHy/3i4ejngPlhy5q2SEL/Mv62F0Y8s8KOIhBR7AE=
CSRF_SECRET=XSl40s/F0LGMgix1hvza0oe96esAnnxqv7ERHsjFvcM=
SESSION_SECRET=fpKGiETFZgQqF1h3bgobQLOVdkB25kBl5jj62LBxmIA=
```

3. **Start the full stack with Docker:**

```bash
# From the project root
docker-compose up -d

# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

4. **Access the application:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/health

5. **Create your first user:**

Open http://localhost:3000 and click "Register" to create an account.

6. **Stop the demo:**

```bash
docker-compose down

# To completely reset (delete all data):
docker-compose down -v
```

---

## What to Test in Full Demo

### ✅ Authentication
- [ ] User registration
- [ ] Email verification (if email configured)
- [ ] Login/logout
- [ ] Password reset
- [ ] Session persistence

### ✅ Projects
- [ ] Create new knitting project
- [ ] Upload project photos
- [ ] Add notes and details
- [ ] Track project status
- [ ] Delete projects

### ✅ Row/Stitch Counters
- [ ] Add multiple counters to a project
- [ ] Increment/decrement counts
- [ ] Counter history
- [ ] Undo functionality
- [ ] Reset counters

### ✅ Pattern Management
- [ ] Upload PDF patterns
- [ ] View patterns
- [ ] Search patterns
- [ ] Link patterns to projects
- [ ] Delete patterns

### ✅ Yarn Stash
- [ ] Add yarn to stash
- [ ] Upload yarn photos
- [ ] Track yarn weight, fiber content
- [ ] Mark yarn as in-use
- [ ] Delete yarn entries

### ✅ Tools
- [ ] Add needles, hooks, accessories
- [ ] Track tool sizes and types
- [ ] Mark tools as in-use
- [ ] Delete tools

### ✅ Recipients
- [ ] Add gift recipients
- [ ] Store measurements
- [ ] Track gift history
- [ ] Link projects to recipients

### ✅ PWA Features
- [ ] Install app (click browser's "Install" button)
- [ ] Works offline (disconnect internet)
- [ ] Data syncs when back online
- [ ] Push notifications (if configured)

### ✅ Dark Mode
- [ ] Toggle dark/light mode
- [ ] Theme persists on reload
- [ ] All pages support both themes

### ✅ Responsive Design
- [ ] Test on mobile viewport (browser dev tools)
- [ ] Test on tablet viewport
- [ ] Test on desktop
- [ ] Touch-friendly buttons (44px+ targets)

### ✅ Export Features
- [ ] Export project as PDF
- [ ] Export data as JSON
- [ ] Print project details

---

## Troubleshooting Demo

### Frontend Not Loading
```bash
# Check if dev server is running
ps aux | grep vite

# Restart frontend
cd /home/user/rowlyknit/frontend
npm run dev
```

### Docker Issues
```bash
# Check Docker is running
docker ps

# Restart all services
docker-compose restart

# Check logs for errors
docker-compose logs backend
docker-compose logs postgres
```

### Port Already in Use
```bash
# Find what's using the port
lsof -i :3000  # Frontend
lsof -i :5000  # Backend

# Kill the process or change ports in config
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View postgres logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d
docker-compose exec backend npm run migrate
```

---

## Current Status

**Frontend Dev Server:** ✅ RUNNING on http://localhost:3000
**Backend:** ❌ Not running (API calls will fail)
**Database:** ❌ Not running (data won't persist)

### To Access Current Demo:

If you're running this in Claude Code's environment, the frontend should be accessible at:
- http://localhost:3000

If you're on your local machine, you can follow the "Full Local Demo" instructions above.

---

## Next Steps

After testing the demo:

1. **If everything looks good:** Follow `PRODUCTION_DEPLOYMENT.md` to deploy to production server
2. **If issues found:** Report them and we can fix before deployment
3. **Want to test more:** Follow the "Full Local Demo" section above

---

## Demo Credentials

For the full demo (when backend is running), you can create test accounts:

**First User (Admin):**
- Email: demo@rowlyknit.com
- Password: Demo123!@#

Or create your own via the registration page!

---

## Questions?

- Check `README.md` for general information
- Check `PRODUCTION_DEPLOYMENT.md` for deployment instructions
- Check `docs/` folder for additional documentation
