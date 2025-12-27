# Digital Ocean Deployment Guide

## Prerequisites

1. Digital Ocean Droplet (Ubuntu 22.04)
2. Docker & Docker Compose installed
3. Git installed
4. Domain name (optional, for HTTPS)

## Initial Setup on Digital Ocean

### 1. Connect to your Droplet

```bash
ssh root@your_droplet_ip
```

### 2. Install Docker

```bash
# Update packages
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 3. Install Git

```bash
apt install git -y
```

### 4. Clone Repository

```bash
cd /opt
git clone https://github.com/your-username/aziz_bot_grammy.git
cd aziz_bot_grammy
```

### 5. Setup Environment Variables

```bash
cp .env.example .env
nano .env
```

Update the following variables:
```env
BOT_TOKEN=your_actual_bot_token_from_botfather
BOT_USERNAME=your_bot_username
DB_PASSWORD=create_strong_password_here
DATABASE_URL=postgresql://azizbot:your_password@postgres:5432/aziz_bot_db?schema=public
```

### 6. Make deployment script executable

```bash
chmod +x deploy.sh
```

## Deployment

### First Time Deployment

```bash
# Build and start services
docker compose up -d --build

# Check if services are running
docker compose ps

# View logs
docker compose logs -f
```

### Run Database Migrations

```bash
docker compose exec app pnpm prisma migrate deploy
```

### Verify Bot is Running

```bash
# Check application logs
docker compose logs app -f

# Check if bot is responding
curl http://localhost:3000/health
```

## Subsequent Deployments

Use the deploy script:

```bash
./deploy.sh
```

Or manually:

```bash
git pull origin main
docker compose down
docker compose up -d --build
docker compose exec app pnpm prisma migrate deploy
```

## Useful Commands

### View logs

```bash
# All services
docker compose logs -f

# App only
docker compose logs app -f

# Last 100 lines
docker compose logs --tail=100
```

### Restart services

```bash
docker compose restart
```

### Stop services

```bash
docker compose down
```

### Remove everything (including volumes)

```bash
docker compose down -v
```

### Database backup

```bash
docker compose exec postgres pg_dump -U azizbot aziz_bot_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database restore

```bash
docker compose exec -T postgres psql -U azizbot aziz_bot_db < backup.sql
```

### Access database

```bash
docker compose exec postgres psql -U azizbot -d aziz_bot_db
```

### Check disk usage

```bash
docker system df
```

### Clean unused images and containers

```bash
docker system prune -a
```

## Monitoring

### Install monitoring tools (optional)

```bash
# Install htop
apt install htop -y

# Monitor resources
htop
```

### Check container resources

```bash
docker stats
```

## Firewall Setup

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP (if needed)
ufw allow 80/tcp

# Allow HTTPS (if needed)
ufw allow 443/tcp

# Enable firewall
ufw enable
```

## Auto-start on Reboot

Docker containers with `restart: unless-stopped` will automatically start on system reboot.

To test:
```bash
reboot
# Wait for system to restart
ssh root@your_droplet_ip
docker compose ps
```

## Troubleshooting

### Bot not starting

```bash
# Check logs
docker compose logs app

# Check if database is ready
docker compose logs postgres

# Restart app
docker compose restart app
```

### Database connection issues

```bash
# Check if postgres is running
docker compose ps postgres

# Check connection
docker compose exec app pnpm prisma db push
```

### Out of memory

If you see memory errors:
1. Upgrade your droplet
2. Or add swap:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Container keeps restarting

```bash
# Check logs
docker compose logs app --tail=200

# Check health
docker compose ps
```

## SSL/HTTPS Setup (Optional)

If you have a domain name:

```bash
# Install Nginx
apt install nginx certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com

# Configure Nginx as reverse proxy
nano /etc/nginx/sites-available/default
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Test and reload Nginx
nginx -t
systemctl reload nginx
```

## Performance Optimization

### For 1GB Droplet

Update docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Database optimization

Create `postgresql.conf` tweaks:
```bash
docker compose exec postgres bash -c "echo 'shared_buffers = 128MB' >> /var/lib/postgresql/data/postgresql.conf"
docker compose restart postgres
```

## Support

For issues, check:
1. Application logs: `docker compose logs app`
2. Database logs: `docker compose logs postgres`
3. System resources: `htop` or `docker stats`
