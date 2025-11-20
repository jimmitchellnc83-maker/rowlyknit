# Rowly Documentation

Welcome to the Rowly documentation! This directory contains all project documentation organized by category.

## 📁 Directory Structure

### [Getting Started](getting-started/)
Documentation for onboarding and understanding the project:
- **CODEBASE_ANALYSIS.md** - Comprehensive codebase overview
- **DEMO_GUIDE.md** - Demo walkthrough and testing

### [Deployment](deployment/)
Production deployment and operations:
- **DEPLOYMENT_GUIDE.md** - Complete production deployment guide
- **TROUBLESHOOTING.md** - Common issues and solutions
- **DEPLOYMENT.md** - Additional deployment notes

### [Features](features/)
Feature documentation and roadmap:
- **FEATURES_COMPLETE.md** - Completed features list
- **IMPLEMENTATION_PLAN.md** - Development roadmap
- **UNINTEGRATED_FEATURES.md** - Components built but not yet integrated

### [Security](security/)
Security documentation and audits:
- **SECURITY_AUDIT_FINAL_2025.md** - Latest security audit report
- **AUDIT_REPORT.md** - Comprehensive audit findings

### [API](api/)
API documentation and examples (coming soon)

### [Archive](archive/)
Historical documents and old versions

## 🚀 Quick Links

**New to the project?** Start here:
1. [README.md](../README.md) - Project overview
2. [CODEBASE_ANALYSIS.md](getting-started/CODEBASE_ANALYSIS.md) - Understand the codebase
3. [DEMO_GUIDE.md](getting-started/DEMO_GUIDE.md) - Try the demo

**Deploying to production?**
1. [DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) - Full deployment guide
2. [TROUBLESHOOTING.md](deployment/TROUBLESHOOTING.md) - Fix common issues

**Understanding features?**
1. [FEATURES_COMPLETE.md](features/FEATURES_COMPLETE.md) - What's implemented
2. [IMPLEMENTATION_PLAN.md](features/IMPLEMENTATION_PLAN.md) - What's planned

**Security review?**
1. [SECURITY_AUDIT_FINAL_2025.md](security/SECURITY_AUDIT_FINAL_2025.md) - Latest audit

## 📝 Document Maintenance

### Adding New Documentation
- Place docs in the appropriate category folder
- Update this README with links to new docs
- Follow existing naming conventions (UPPER_CASE_WITH_UNDERSCORES.md)
- Include a clear title and purpose at the top

### Updating Existing Documentation
- Update the document in place
- Add date/version info if significant changes
- Move superseded versions to `archive/`

### Archiving Old Documents
- Move to `archive/` folder
- Add `.OLD` or `.SUPERSEDED` suffix if helpful
- Don't delete—historical context is valuable

## 🔍 Finding Information

**Use grep to search all docs:**
```bash
# Search all documentation
grep -r "search term" docs/

# Search specific category
grep -r "deployment" docs/deployment/
```

**Browse by category:**
```bash
# List all docs
find docs/ -name "*.md" -type f

# List by category
ls docs/getting-started/
ls docs/deployment/
ls docs/features/
```

## 📞 Need Help?

- **Issues**: [GitHub Issues](https://github.com/jimmitchellnc83-maker/rowlyknit/issues)
- **Main README**: [../README.md](../README.md)
- **Reorganization Guide**: [REPOSITORY_REORGANIZATION.md](REPOSITORY_REORGANIZATION.md)

---

**Documentation Structure Last Updated**: November 20, 2025
