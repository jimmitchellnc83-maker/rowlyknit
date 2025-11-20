# Rowly Scripts

This directory contains all utility scripts organized by category.

## 📁 Directory Structure

### [deployment/](deployment/)
Production deployment scripts:
- `DEPLOY_TO_PRODUCTION_NOW.sh` - Main production deployment
- `QUICK_DEPLOY.sh` - Fast deployment for minor updates
- `DEPLOY_CACHE_FIX_NOW.sh` - Deploy with cache fixes
- `deploy.sh` - Generic deployment script
- `DEPLOY_NOW.sh` - Alternative deployment script
- `deploy-with-password.exp` - Expect script for automated deployment
- `deploy-production.sh` - Production-specific deployment
- `diagnose-production.sh` - Production diagnostics
- `setup-env-production.sh` - Production environment setup

### [dev/](dev/)
Development and debugging scripts:
- `docker-debug.sh` - Debug Docker containers
- `fix-and-rebuild.sh` - Fix issues and rebuild
- `rebuild-clean.sh` - Clean rebuild from scratch

### [maintenance/](maintenance/)
Maintenance and operations scripts:
- `restart-nginx.sh` - Restart Nginx server

### [database/](database/)
Database utilities (coming soon):
- Backup scripts
- Migration utilities
- Data management tools

## 🚀 Quick Start

### Deployment

```bash
# Production deployment
cd scripts/deployment
./DEPLOY_TO_PRODUCTION_NOW.sh

# Quick deployment (minor updates)
./QUICK_DEPLOY.sh

# Setup production environment
./setup-env-production.sh

# Diagnose production issues
./diagnose-production.sh
```

### Development

```bash
# Debug Docker issues
cd scripts/dev
./docker-debug.sh

# Clean rebuild
./rebuild-clean.sh

# Fix and rebuild
./fix-and-rebuild.sh
```

### Maintenance

```bash
# Restart Nginx
cd scripts/maintenance
./restart-nginx.sh
```

## 📝 Script Guidelines

### Creating New Scripts

1. **Choose the right directory**:
   - `deployment/` - Production deployment and setup
   - `dev/` - Development utilities
   - `maintenance/` - Ongoing operations
   - `database/` - Database operations

2. **Make scripts executable**:
   ```bash
   chmod +x your-script.sh
   ```

3. **Add shebang line**:
   ```bash
   #!/bin/bash
   ```

4. **Include usage documentation** at the top:
   ```bash
   #!/bin/bash
   # Script Name: your-script.sh
   # Description: What this script does
   # Usage: ./your-script.sh [options]
   # Author: Your Name
   # Date: YYYY-MM-DD
   ```

5. **Handle errors gracefully**:
   ```bash
   set -e  # Exit on error
   set -u  # Exit on undefined variable
   set -o pipefail  # Exit on pipe failure
   ```

6. **Update this README** with the new script

### Script Best Practices

- ✅ Use descriptive names (e.g., `deploy-production.sh` not `dp.sh`)
- ✅ Add comments explaining complex logic
- ✅ Include error handling and validation
- ✅ Use absolute paths or `cd` to correct directory
- ✅ Test in non-production environment first
- ✅ Add logging for important operations
- ⚠️ Never commit secrets or passwords
- ⚠️ Use environment variables for configuration
- ⚠️ Add confirmation prompts for destructive operations

## 🔍 Finding Scripts

**List all scripts:**
```bash
find scripts/ -name "*.sh" -type f
```

**Search for specific scripts:**
```bash
# Find deployment scripts
find scripts/deployment/ -name "*.sh"

# Find scripts containing a keyword
grep -r "docker" scripts/
```

**View script usage:**
```bash
# Most scripts support --help
./scripts/deployment/DEPLOY_TO_PRODUCTION_NOW.sh --help
```

## ⚠️ Important Notes

### Deployment Scripts
- **Always backup** before running deployment scripts
- **Test locally** with Docker before deploying to production
- **Review changes** before running deployment
- **Monitor logs** during and after deployment

### Environment Variables
Many scripts require environment variables. Check:
- `backend/.env` for backend configuration
- `deployment/.env` for deployment configuration
- Script documentation for required variables

### Permissions
Some scripts require:
- Root/sudo access
- SSH keys configured
- Docker daemon running
- Specific ports available

## 📞 Need Help?

- **Script fails?** Check [docs/deployment/TROUBLESHOOTING.md](../docs/deployment/TROUBLESHOOTING.md)
- **Deployment issues?** See [docs/deployment/DEPLOYMENT_GUIDE.md](../docs/deployment/DEPLOYMENT_GUIDE.md)
- **Development setup?** Check [docs/getting-started/](../docs/getting-started/)
- **Report bugs**: [GitHub Issues](https://github.com/jimmitchellnc83-maker/rowlyknit/issues)

## 🔐 Security

- **Never commit** scripts containing passwords or secrets
- **Use environment variables** for sensitive configuration
- **Restrict permissions** on scripts containing sensitive logic
- **Review scripts** before running in production
- **Audit regularly** for security issues

## 📚 Related Documentation

- [Deployment Guide](../docs/deployment/DEPLOYMENT_GUIDE.md)
- [Troubleshooting](../docs/deployment/TROUBLESHOOTING.md)
- [Repository Reorganization](../docs/REPOSITORY_REORGANIZATION.md)
- [Main README](../README.md)

---

**Scripts Directory Last Updated**: November 20, 2025
