#!/bin/bash
# =============================================================
# MSFG Calculator Suite — Start / Restart App
# Usage: bash deploy/start.sh
# =============================================================

set -e

echo "Starting MSFG Calculator Suite..."

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "PORT=3000" > .env
    echo "NODE_ENV=production" >> .env
    echo "  Created .env"
fi

# Start or restart with PM2
pm2 describe msfg-calc > /dev/null 2>&1 && {
    echo "  Restarting existing process..."
    pm2 restart msfg-calc
} || {
    echo "  Starting new process..."
    pm2 start ecosystem.config.js
}

# Save PM2 process list (survives reboot)
pm2 save

# Set PM2 to start on boot (run once)
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "========================================="
echo "  App running on port 3000"
echo "  Nginx proxying port 80 -> 3000"
echo ""
echo "  Useful commands:"
echo "    pm2 status        — check status"
echo "    pm2 logs msfg-calc — view logs"
echo "    pm2 restart msfg-calc — restart"
echo "========================================="
