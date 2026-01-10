# Digital Ocean Droplet - Deployment Guide

Complete guide for deploying Aziz Kino Bot to Digital Ocean droplet.

## Prerequisites

- Digital Ocean account
- Domain name (optional, for SSL)
- SSH key pair
- Bot token from @BotFather

## Server Requirements

- **OS**: Ubuntu 22.04 LTS
- **RAM**: Minimum 2GB (Recommended 4GB)
- **Storage**: 25GB SSD
- **CPU**: 1-2 vCPUs

---

## 1. Initial Droplet Setup

### Create Droplet
1. Log in to Digital Ocean
2. Create new Droplet
3. Choose Ubuntu 22.04 LTS
4. Select at least Basic plan ($12/month - 2GB RAM)
5. Add your SSH key
6. Choose datacenter region close to your users

### Connect to Droplet
```bash
ssh root@YOUR_DROPLET_IP
```

---

## 2. Install Required Software

### Update System
```bash
apt update && apt upgrade -y
```

### Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker service
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
```

### Install Docker Compose
```bash
# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker compose version
```

### Install Git
```bash
apt install git -y
```

---

## 3. Clone and Setup Project

### Clone Repository
```bash
# Create app directory
mkdir -p /opt/apps
cd /opt/apps

# Clone your repository
git clone https://github.com/XushvaqtovSardor/aziz_kino_bot_withgrammy.git
cd aziz_kino_bot_withgrammy
```

### Setup Environment Variables
```bash
# Create .env file
nano .env
```

Paste the following configuration (modify with your values):

```env
# Bot Configuration
BOT_TOKEN=your_bot_token_here
NODE_ENV=production
WEB_PANEL_URL=http://YOUR_DROPLET_IP:3000/admin/

# Database Configuration
DATABASE_URL="postgresql://azizbot:STRONG_PASSWORD_HERE@postgres:5432/aziz_bot_db?schema=public"
DB_USER=azizbot
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=aziz_bot_db

# Optional: PgAdmin
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=admin_strong_password
```

**Important**: Replace:
- `your_bot_token_here` with your actual bot token
- `STRONG_PASSWORD_HERE` with a strong password
- `YOUR_DROPLET_IP` with your droplet's IP address

Save and exit (Ctrl+X, then Y, then Enter)

---

## 4. Prepare and Build

### Set Correct Permissions
```bash
chmod +x deploy.sh
chmod +x setup-droplet.sh
```

### Build Docker Images
```bash
docker compose build
```

---

## 5. Database Setup

### Start PostgreSQL First
```bash
docker compose up -d postgres
```

### Wait for Database to be Ready
```bash
# Check if postgres is ready (should show "accepting connections")
docker compose logs postgres | grep "ready"
```

### Run Prisma Migrations
```bash
# Generate Prisma Client
docker compose run --rm app npx prisma generate

# Run migrations
docker compose run --rm app npx prisma migrate deploy
```

---

## 6. Start Application

### Start All Services
```bash
docker compose up -d
```

### Verify Services are Running
```bash
docker compose ps
```

You should see:
- `aziz_bot_app` - running
- `aziz_bot_postgres` - running

### Check Logs
```bash
# Check app logs
docker compose logs -f app

# Check postgres logs
docker compose logs -f postgres

# Check last 100 lines
docker compose logs --tail=100 app
```

---

## 7. Configure Firewall

### Setup UFW Firewall
```bash
# Enable UFW
ufw enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS (if you plan to use web panel)
ufw allow 80/tcp
ufw allow 443/tcp

# Allow application port
ufw allow 3000/tcp

# Check status
ufw status
```

---

## 8. Setup Nginx (Optional - for SSL and domain)

### Install Nginx
```bash
apt install nginx -y
```

### Configure Nginx
```bash
nano /etc/nginx/sites-available/aziz-bot
```

Paste configuration:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Site
```bash
ln -s /etc/nginx/sites-available/aziz-bot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Setup SSL with Let's Encrypt (Optional)
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com

# Auto-renewal is enabled by default
# Test renewal
certbot renew --dry-run
```

---

## 9. Monitoring and Maintenance

### View Real-time Logs
```bash
docker compose logs -f app
```

### Check Resource Usage
```bash
docker stats
```

### Restart Services
```bash
# Restart app only
docker compose restart app

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Start all services
docker compose up -d
```

### Update Application
```bash
cd /opt/apps/aziz_kino_bot_withgrammy

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Run migrations if needed
docker compose run --rm app npx prisma migrate deploy
```

### Database Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U azizbot aziz_bot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker compose exec -T postgres psql -U azizbot aziz_bot_db < backup_file.sql
```

### Clean Docker Resources
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup (careful!)
docker system prune -a --volumes
```

---

## 10. Troubleshooting

### Bot Not Responding
```bash
# Check if app is running
docker compose ps

# Check app logs
docker compose logs --tail=100 app

# Restart app
docker compose restart app
```

### Database Connection Issues
```bash
# Check postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test database connection
docker compose exec postgres psql -U azizbot -d aziz_bot_db -c "SELECT 1;"
```

### Out of Memory
```bash
# Check memory usage
free -h
docker stats

# Restart services to free memory
docker compose restart
```

### Port Already in Use
```bash
# Find process using port 3000
netstat -tulpn | grep :3000

# Kill process if needed
kill -9 PID
```

---

## 11. Security Best Practices

### Regular Updates
```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker compose pull
docker compose up -d
```

### Secure SSH
```bash
# Disable root login (after creating sudo user)
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart ssh
```

### Backup Strategy
- Regular database backups (daily recommended)
- Store backups off-server (Digital Ocean Spaces, S3, etc.)
- Test restore process regularly

### Monitor Logs
```bash
# Check error logs regularly
docker compose logs app | grep ERROR

# Set up log rotation in docker-compose.yml (already configured)
```

---

## 12. Performance Optimization

### Docker Resource Limits
Already configured in `docker-compose.yml`:
- Memory limits
- Log rotation
- Health checks

### Database Optimization
```bash
# Connect to postgres
docker compose exec postgres psql -U azizbot aziz_bot_db

# Run VACUUM
VACUUM ANALYZE;

# Check database size
\l+
```

---

## 13. Quick Commands Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f app

# Restart app
docker compose restart app

# Update code
git pull && docker compose up -d --build

# Database backup
docker compose exec postgres pg_dump -U azizbot aziz_bot_db > backup.sql

# Check status
docker compose ps

# Check resource usage
docker stats

# Access database
docker compose exec postgres psql -U azizbot aziz_bot_db
```

---

## Support

If you encounter issues:
1. Check logs: `docker compose logs app`
2. Verify environment variables: `cat .env`
3. Check service status: `docker compose ps`
4. Review error logs in `logs/error-*.log`

---

## Useful Links

- [Docker Documentation](https://docs.docker.com/)
- [Digital Ocean Tutorials](https://www.digitalocean.com/community/tutorials)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Last Updated**: January 10, 2026
**Version**: 1.0.0
