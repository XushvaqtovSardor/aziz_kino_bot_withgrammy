# Deployment Checklist for Digital Ocean

## Pre-Deployment
- [ ] Update `.env` with production values
- [ ] Change `DB_PASSWORD` from default
- [ ] Update `BOT_TOKEN` with real token
- [ ] Set correct `WEB_PANEL_URL` with droplet IP
- [ ] Review and test docker-compose.yml
- [ ] Commit and push all changes to GitHub

## Droplet Setup
- [ ] Create Digital Ocean droplet (Ubuntu 22.04)
- [ ] Connect via SSH
- [ ] Install Docker and Docker Compose
- [ ] Install Git
- [ ] Configure firewall (UFW)

## Application Deployment
- [ ] Clone repository to `/opt/apps/`
- [ ] Create and configure `.env` file
- [ ] Build Docker images
- [ ] Start PostgreSQL service
- [ ] Run Prisma migrations
- [ ] Start all services
- [ ] Verify logs for errors

## Post-Deployment
- [ ] Test bot functionality
- [ ] Access web panel
- [ ] Verify database connectivity
- [ ] Set up log monitoring
- [ ] Configure automatic backups
- [ ] Set up SSL (if using domain)

## Optional
- [ ] Configure Nginx reverse proxy
- [ ] Set up monitoring (docker-compose.monitoring.yml)
- [ ] Configure domain name
- [ ] Set up automatic updates
- [ ] Create backup scripts

## Testing
- [ ] Send test message to bot
- [ ] Test user registration
- [ ] Test admin panel access
- [ ] Test database operations
- [ ] Check error logging
- [ ] Monitor resource usage

## Documentation
- [ ] Read DIGITAL_OCEAN_DEPLOY.md
- [ ] Save droplet IP and credentials securely
- [ ] Document any custom configurations
- [ ] Create incident response plan
