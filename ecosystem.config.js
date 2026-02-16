// PM2 Process Manager Configuration
module.exports = {
  apps: [{
    name: 'msfg-calc',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
