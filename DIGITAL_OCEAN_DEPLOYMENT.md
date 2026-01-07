# Digital Ocean Droplet ga Deploy qilish

## 1. Dropletga birinchi marta ulanish

SSH orqali dropletga ulanish:
```bash
ssh -i droplet_2 root@165.232.136.50
```

## 2. Dropletni tayyorlash

### Docker o'rnatish
```bash
# Sistemani yangilash
apt update && apt upgrade -y

# Kerakli paketlarni o'rnatish
apt install -y apt-transport-https ca-certificates curl software-properties-common git

# Docker GPG kalitini qo'shish
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker repository qo'shish
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker o'rnatish
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker Compose o'rnatish (standalone)
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Docker'ni avtomatik ishga tushirish
systemctl enable docker
systemctl start docker

# Tekshirish
docker --version
docker-compose --version
```

### Firewall sozlash
```bash
# UFW o'rnatish va sozlash
apt install -y ufw

# Asosiy portlarni ochish
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS

# UFW ni yoqish
ufw --force enable
ufw status
```

## 3. Loyihani dropletga ko'chirish

### Variant 1: Git orqali (tavsiya etiladi)
```bash
# Dropletda
cd /opt
git clone https://github.com/gaday078-spec/aziz_bot.git
cd aziz_bot
```

### Variant 2: Local'dan rsync orqali
```bash
# Local kompyuteringizda
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'logs' \
  --exclude 'dist' \
  -e "ssh -i droplet_2" \
  . root@165.232.136.50:/opt/aziz_bot/
```

### Variant 3: Local'dan scp orqali
```bash
# Local kompyuteringizda
# Loyihani arxivlash
tar -czf aziz_bot.tar.gz --exclude='node_modules' --exclude='.git' --exclude='logs' --exclude='dist' .

# Arxivni yuklash
scp -i droplet_2 aziz_bot.tar.gz root@165.232.136.50:/opt/

# Dropletda arxivni ochish
ssh -i droplet_2 root@165.232.136.50
cd /opt
tar -xzf aziz_bot.tar.gz -C aziz_bot
cd aziz_bot
rm /opt/aziz_bot.tar.gz
```

## 4. Environment sozlash

```bash
# Dropletda
cd /opt/aziz_bot

# .env faylini yaratish
cp .env.example .env
nano .env
```

### .env faylini to'ldirish:
```env
# Telegram Bot
BOT_TOKEN=your_actual_bot_token
BOT_USERNAME=your_bot_username

# Database (Local PostgreSQL)
DB_USER=azizbot
DB_PASSWORD=your_super_strong_password_here
DB_NAME=aziz_bot_db
DB_HOST=postgres
DB_PORT=5432

# Database URL
DATABASE_URL=postgresql://azizbot:your_super_strong_password_here@postgres:5432/aziz_bot_db?schema=public

# Application
NODE_ENV=production
PORT=3000

# Payme Integration
PAYME_MERCHANT_ID=your_payme_merchant_id
PAYME_KEY=your_payme_production_key
PAYME_TEST_KEY=your_payme_test_key
PAYME_ENDPOINT=https://checkout.paycom.uz
```

**Ctrl+O** - saqlash, **Ctrl+X** - chiqish

## 5. Deploy qilish

### Birinchi marta deploy
```bash
cd /opt/aziz_bot

# Deploy scriptga ruxsat berish
chmod +x deploy.sh

# Deploy qilish
./deploy.sh
```

### Keyingi deploylar
```bash
cd /opt/aziz_bot

# Kodlarni yangilash (Git orqali)
git pull origin main

# Deploy qilish
./deploy.sh

# Yoki tezroq (build'siz)
./deploy.sh --skip-build
```

## 6. Docker buyruqlari

### Konteynerlarni boshqarish
```bash
# Barcha konteynerlarni ko'rish
docker-compose ps

# Loglarni ko'rish
docker-compose logs -f
docker-compose logs -f app        # Faqat bot
docker-compose logs -f postgres   # Faqat database

# Konteynerlarni to'xtatish
docker-compose stop

# Konteynerlarni ishga tushirish
docker-compose start

# Konteynerlarni qayta ishga tushirish
docker-compose restart

# Konteynerlarni to'xtatish va o'chirish
docker-compose down

# Volume'lar bilan birga o'chirish (EHTIYOT!)
docker-compose down -v
```

### Debuging va monitoring
```bash
# Bot konteyneriga kirish
docker exec -it aziz_bot_app sh

# Database konteyneriga kirish
docker exec -it aziz_bot_postgres psql -U azizbot -d aziz_bot_db

# Resurslarni ko'rish
docker stats

# Disk ishlatilishini ko'rish
docker system df
```

### Database backup
```bash
# Manual backup
docker exec aziz_bot_postgres pg_dump -U azizbot aziz_bot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup'ni restore qilish
docker exec -i aziz_bot_postgres psql -U azizbot aziz_bot_db < backup_20260107_120000.sql
```

## 7. Monitoring va logs

### Real-time monitoring
```bash
# Bot loglarini kuzatish
docker-compose logs -f app

# Xatolarni qidirish
docker-compose logs app | grep ERROR

# Oxirgi 100 ta log
docker-compose logs --tail=100 app
```

### System monitoring
```bash
# Disk space
df -h

# Memory usage
free -m

# Docker containers resources
docker stats

# Process list
htop  # yoki top
```

## 8. Automatic deployment (CI/CD)

### GitHub Actions orqali
Loyihangizga `.github/workflows/deploy.yml` fayli qo'shing:

```yaml
name: Deploy to Digital Ocean

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to droplet
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/aziz_bot
            git pull origin main
            ./deploy.sh --skip-build
```

GitHub repository Settings → Secrets da qo'shing:
- `DROPLET_IP`: 165.232.136.50
- `SSH_PRIVATE_KEY`: droplet_2 faylining mazmuni

## 9. Troubleshooting

### Bot ishlamayotgan bo'lsa
```bash
# Statusni tekshirish
docker-compose ps

# Loglarni ko'rish
docker-compose logs app | tail -50

# Konteynerlarni qayta ishga tushirish
docker-compose restart app

# To'liq qayta build qilish
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database bilan muammo
```bash
# Database statusini tekshirish
docker-compose exec postgres pg_isready -U azizbot

# Database'ga ulanish
docker-compose exec postgres psql -U azizbot -d aziz_bot_db

# Migration qaytadan ishlatish
docker-compose run --rm app pnpm prisma migrate deploy

# Database'ni reset qilish (EHTIYOT!)
docker-compose down -v
docker-compose up -d postgres
docker-compose run --rm app pnpm prisma migrate deploy
docker-compose up -d
```

### Disk to'lgan bo'lsa
```bash
# Docker cache'ni tozalash
docker system prune -a

# Eski loglarni o'chirish
rm -rf logs/*

# Eski backuplarni o'chirish
find backups/ -type f -mtime +30 -delete  # 30 kundan eski
```

## 10. Xavfsizlik

### SSH kalitini himoyalash
```bash
# Dropletda
# Parol bilan kirish ni o'chirish
nano /etc/ssh/sshd_config

# Quyidagilarni o'zgartiring:
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin prohibit-password

# SSH'ni qayta ishga tushirish
systemctl restart sshd
```

### Automatic updates
```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Fail2ban o'rnatish
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

## 11. Backup strategiyasi

### Automatic backup script yaratish
```bash
nano /opt/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker exec aziz_bot_postgres pg_dump -U azizbot aziz_bot_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Eski backuplarni o'chirish (7 kundan eski)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

```bash
chmod +x /opt/backup.sh

# Cron job qo'shish (har kuni soat 3 da)
crontab -e

# Qo'shing:
0 3 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
```

## 12. Useful commands cheat sheet

```bash
# Tez deploy
cd /opt/aziz_bot && git pull && ./deploy.sh --skip-build

# Loglarni real-time kuzatish
docker-compose logs -f --tail=50 app

# Bot'ni restart qilish
docker-compose restart app

# Database backup
docker exec aziz_bot_postgres pg_dump -U azizbot aziz_bot_db > backup.sql

# Disk space tekshirish
df -h
docker system df

# Bot statusini tekshirish
curl http://localhost:3000/health

# Konteyner ichida command ishlatish
docker-compose exec app pnpm prisma studio
```

## 13. Monitoring va alertlar

### Simple health check script
```bash
nano /opt/healthcheck.sh
```

```bash
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
TELEGRAM_BOT_TOKEN="your_monitoring_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"

if ! curl -sf $HEALTH_URL > /dev/null; then
    MESSAGE="🚨 Bot ishlamayapti! $(date)"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d chat_id=$TELEGRAM_CHAT_ID \
        -d text="$MESSAGE"
    
    # Restart qilishga urinish
    cd /opt/aziz_bot && docker-compose restart app
fi
```

```bash
chmod +x /opt/healthcheck.sh

# Cron job (har 5 daqiqada)
crontab -e
*/5 * * * * /opt/healthcheck.sh
```
