#!/bin/bash
# =============================================================
# MSFG Calculator Suite — Pull & Deploy Update
# Usage: bash deploy/update.sh
# =============================================================

set -e

echo "Deploying update..."

# Pull latest code
echo "[1/3] Pulling latest from main..."
git pull origin main

# Install any new dependencies
echo "[2/3] Installing dependencies..."
npm ci --production

# Restart the app
echo "[3/3] Restarting app..."
pm2 restart msfg-calc

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "  pm2 logs msfg-calc  — check logs"
echo "========================================="
