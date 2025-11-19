#!/bin/bash
# Docker debugging script

echo "==> Current Dockerfile content (lines 10-20):"
cat -n backend/Dockerfile | sed -n '10,20p'

echo ""
echo "==> Git status:"
git status --short

echo ""
echo "==> Recent commits:"
git log --oneline -5

echo ""
echo "==> Checking package-lock.json:"
ls -lh backend/package-lock.json
echo "In git:" 
git ls-files backend/package-lock.json || echo "NOT TRACKED"

echo ""
echo "==> Docker images:"
docker images | grep -E "(REPOSITORY|rowly)"

echo ""
echo "==> Docker build cache:"
docker system df
