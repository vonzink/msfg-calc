#!/bin/bash
# =============================================================
# MSFG Calculator Suite — Pull & Deploy Update
# Usage: bash deploy/update.sh
# =============================================================

set -e

echo "Deploying update..."

# Pull latest code
echo "[1/4] Pulling latest from main..."
git pull origin main

# Install ALL dependencies (including devDeps needed for build)
echo "[2/4] Installing dependencies..."
npm ci

# Build minified JS
echo "[3/4] Building minified assets..."
npm run build

# Restart the app
echo "[4/4] Restarting app..."
pm2 restart msfg-calc

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "  pm2 logs msfg-calc  — check logs"
echo "========================================="
