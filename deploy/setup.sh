#!/bin/bash
# =============================================================
# MSFG Calculator Suite — EC2 Initial Setup (Ubuntu)
# Run this ONCE on a fresh EC2 instance
# Usage: bash deploy/setup.sh
# =============================================================

set -e

echo "========================================="
echo "  MSFG Calculator Suite — Server Setup"
echo "========================================="

# Update system
echo "[1/6] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
echo "[2/6] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"

# Install PM2 globally
echo "[3/6] Installing PM2 process manager..."
sudo npm install -g pm2

# Install nginx
echo "[4/6] Installing nginx..."
sudo apt install -y nginx

# Configure nginx
echo "[5/6] Configuring nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/msfg-calc
sudo ln -sf /etc/nginx/sites-available/msfg-calc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# Install app dependencies
echo "[6/6] Installing app dependencies..."
npm ci --production

echo ""
echo "========================================="
echo "  Setup complete! Now run:"
echo "  bash deploy/start.sh"
echo "========================================="
