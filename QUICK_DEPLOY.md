# 🚀 Quick Deployment Guide

## One-Command Deploy to Digital Ocean

### 1. Prerequisites
- Digital Ocean Droplet (Ubuntu 22.04, 2GB+ RAM)
- Domain (optional)
- Bot Token from @BotFather

### 2. Initial Setup (One-Time)
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install Git
apt install git -y

# Setup firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw enable
```

### 3. Deploy Application
```bash
# Clone project
cd /opt/apps
git clone https://github.com/XushvaqtovSardor/aziz_kino_bot_withgrammy.git
cd aziz_kino_bot_withgrammy

# Configure environment
cp .env.example .env
nano .env  # Update: BOT_TOKEN, DB_PASSWORD, WEB_PANEL_URL

# Deploy
docker compose up -d
docker compose exec app npx prisma migrate deploy

# Check status
docker compose logs -f app
```

### 4. Verify Deployment
```bash
# Check services
docker compose ps

# Check logs
docker compose logs --tail=50 app

# Test bot
# Send /start to your bot in Telegram
```

## 🔄 Update Application
```bash
cd /opt/apps/aziz_kino_bot_withgrammy
git pull origin main
docker compose down
docker compose build
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

## 🗄️ Backup Database
```bash
docker compose exec postgres pg_dump -U azizbot aziz_bot_db > backup_$(date +%Y%m%d).sql
```

## 📊 View Logs
```bash
# Real-time logs
docker compose logs -f app

# Error logs only
docker compose logs app | grep ERROR

# Last 100 lines
docker compose logs --tail=100 app
```

## 🛑 Stop Services
```bash
docker compose down
```

## 🔧 Troubleshooting

### Bot not responding
```bash
docker compose restart app
docker compose logs app
```

### Database issues
```bash
docker compose restart postgres
docker compose exec postgres psql -U azizbot -d aziz_bot_db -c "SELECT 1;"
```

### Out of memory
```bash
free -h
docker stats
docker compose restart
```

## 📚 Full Documentation
- [Complete Deployment Guide](./DIGITAL_OCEAN_DEPLOY.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Architecture Overview](./ARCHITECTURE.md)

## 🆘 Support
Check logs first:
```bash
docker compose logs app
cat logs/error-*.log
```

## 🔗 Useful Commands
```bash
# Start: docker compose up -d
# Stop: docker compose down
# Restart: docker compose restart
# Logs: docker compose logs -f
# Status: docker compose ps
# Update: git pull && docker compose up -d --build
```
