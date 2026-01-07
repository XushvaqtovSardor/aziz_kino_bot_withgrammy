# Aziz Bot - Quick Commands

## Local Development
```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm prisma migrate dev

# Start development server
pnpm start:dev

# Build for production
pnpm build
```

## Digital Ocean Droplet Commands

### SSH Connection
```bash
# Connect to droplet
ssh -i droplet_2 root@165.232.136.50

# Connect and go to project
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && bash'
```

### Deployment
```bash
# Full deploy (first time or major changes)
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && ./deploy.sh'

# Quick deploy (code changes only)
./quick-deploy.sh "Update message"

# Deploy without rebuild
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && ./deploy.sh --skip-build'

# Deploy without logs
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && ./deploy.sh --no-logs'
```

### Docker Operations
```bash
# View running containers
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml ps'

# View logs (real-time)
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml logs -f --tail=50 app'

# Restart bot
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml restart app'

# Stop all services
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose down'

# Start all services
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose up -d'

# View resource usage
ssh -i droplet_2 root@165.232.136.50 'docker stats --no-stream'
```

### Database Operations
```bash
# Create backup
ssh -i droplet_2 root@165.232.136.50 'docker exec aziz_bot_postgres pg_dump -U azizbot aziz_bot_db > /opt/backups/backup_$(date +%Y%m%d_%H%M%S).sql'

# Run migration
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose run --rm app pnpm prisma migrate deploy'

# Access database console
ssh -i droplet_2 root@165.232.136.50 'docker exec -it aziz_bot_postgres psql -U azizbot -d aziz_bot_db'

# View database size
ssh -i droplet_2 root@165.232.136.50 "docker exec aziz_bot_postgres psql -U azizbot -d aziz_bot_db -c \"SELECT pg_size_pretty(pg_database_size('aziz_bot_db'));\""
```

### Monitoring
```bash
# Check bot health
ssh -i droplet_2 root@165.232.136.50 'curl -s http://localhost:3000/health'

# View recent errors
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml logs --tail=100 app | grep ERROR'

# Check disk space
ssh -i droplet_2 root@165.232.136.50 'df -h'

# Check memory usage
ssh -i droplet_2 root@165.232.136.50 'free -m'

# View system load
ssh -i droplet_2 root@165.232.136.50 'uptime'
```

### File Transfer
```bash
# Upload file to droplet
scp -i droplet_2 local_file.txt root@165.232.136.50:/opt/aziz_bot/

# Download file from droplet
scp -i droplet_2 root@165.232.136.50:/opt/aziz_bot/remote_file.txt ./

# Sync entire project (excluding node_modules)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'logs' -e "ssh -i droplet_2" . root@165.232.136.50:/opt/aziz_bot/
```

### Troubleshooting
```bash
# View all logs
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose logs --tail=200'

# Rebuild and restart
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose down && docker-compose build --no-cache && docker-compose up -d'

# Clear Docker cache
ssh -i droplet_2 root@165.232.136.50 'docker system prune -a -f'

# View environment variables
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && docker-compose config'

# Check container details
ssh -i droplet_2 root@165.232.136.50 'docker inspect aziz_bot_app'
```

### Maintenance
```bash
# Update system packages
ssh -i droplet_2 root@165.232.136.50 'apt update && apt upgrade -y'

# Restart Docker service
ssh -i droplet_2 root@165.232.136.50 'systemctl restart docker'

# View Docker service status
ssh -i droplet_2 root@165.232.136.50 'systemctl status docker'

# Clean old backups (older than 7 days)
ssh -i droplet_2 root@165.232.136.50 'find /opt/backups -type f -mtime +7 -delete'
```

## Windows-specific Commands

### Using Git Bash or PowerShell
```powershell
# Make scripts executable (Git Bash)
chmod +x deploy.sh quick-deploy.sh

# Convert line endings (if needed)
dos2unix deploy.sh
dos2unix quick-deploy.sh

# Or using PowerShell
(Get-Content deploy.sh) | Set-Content -Encoding ASCII deploy.sh
```

### Using WSL
```bash
# If using WSL, you can run bash scripts directly
wsl bash ./quick-deploy.sh "Update message"
```

## One-liner Commands

### Quick status check
```bash
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml ps && echo "---" && curl -s http://localhost:3000/health'
```

### Update and restart
```bash
ssh -i droplet_2 root@165.232.136.50 'cd /opt/aziz_bot && git pull && docker-compose restart app'
```

### View latest logs
```bash
ssh -i droplet_2 root@165.232.136.50 'docker-compose -f /opt/aziz_bot/docker-compose.yml logs --tail=50 --timestamps app'
```

### Complete health check
```bash
ssh -i droplet_2 root@165.232.136.50 'echo "=== Containers ===" && docker ps && echo "=== Disk ===" && df -h / && echo "=== Memory ===" && free -m && echo "=== Health ===" && curl -s http://localhost:3000/health'
```

## Environment Variables Reference

### Required
- `BOT_TOKEN` - Telegram bot token from @BotFather
- `BOT_USERNAME` - Bot username (without @)
- `DATABASE_URL` - PostgreSQL connection string
- `DB_PASSWORD` - Database password

### Optional
- `PAYME_MERCHANT_ID` - Payme merchant ID for payments
- `PAYME_KEY` - Payme production key
- `PAYME_TEST_KEY` - Payme test key
- `PAYME_ENDPOINT` - Payme API endpoint (default: https://checkout.paycom.uz)
- `PORT` - Application port (default: 3000)
- `NODE_ENV` - Environment (production/development)

## Useful Links

- Digital Ocean Droplet: http://165.232.136.50
- Bot Health Check: http://165.232.136.50:3000/health
- Telegram Bot: https://t.me/YOUR_BOT_USERNAME
- GitHub Repo: https://github.com/gaday078-spec/aziz_bot
