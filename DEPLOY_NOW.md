# 🚀 Aziz Bot - Digital Ocean Deploy

## ✅ Tayyor qilingan fayllar:

1. **docker-compose.yml** - Optimallashtirilgan production konfiguratsiya
2. **Dockerfile** - Multi-stage build bilan
3. **deploy.sh** - To'liq deployment script
4. **quick-deploy.sh** - Tez yangilash uchun
5. **setup-droplet.sh** - Dropletni birinchi marta sozlash
6. **DIGITAL_OCEAN_DEPLOYMENT.md** - To'liq qo'llanma
7. **COMMANDS.md** - Barcha kerakli buyruqlar

## 📋 Deploy qilish bosqichlari:

### 1️⃣ Dropletni tayyorlash (birinchi marta)

SSH orqali ulaning:
```bash
ssh -i droplet_2 root@165.232.136.50
```

Setup scriptni ishga tushiring:
```bash
# Script yuklab oling
curl -sSL https://raw.githubusercontent.com/gaday078-spec/aziz_bot/main/setup-droplet.sh > setup.sh

# Yoki manual ravishda copy-paste qiling
nano setup.sh
# Scriptni joylashtiring va Ctrl+O, Ctrl+X

# Ishga tushiring
chmod +x setup.sh
bash setup.sh
```

Bu script:
- Docker va Docker Compose o'rnatadi
- Firewall sozlaydi (SSH, HTTP, HTTPS)
- Fail2Ban o'rnatadi
- Automatic updates sozlaydi
- Kerakli papkalarni yaratadi

### 2️⃣ Loyihani dropletga ko'chirish

**Variant A: Git orqali (tavsiya etiladi)**
```bash
cd /opt/aziz_bot
git clone https://github.com/gaday078-spec/aziz_bot.git .
```

**Variant B: Local'dan rsync orqali (Windows'da Git Bash)**
```bash
# Lokalda ishlatng (Git Bash yoki WSL)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'logs' \
  --exclude 'dist' \
  -e "ssh -i droplet_2" \
  . root@165.232.136.50:/opt/aziz_bot/
```

**Variant C: Manual copy (Windows)**
```bash
# 1. Loyihani arxivlang
tar -czf aziz_bot.tar.gz --exclude=node_modules --exclude=.git --exclude=logs --exclude=dist .

# 2. Dropletga yuboring (Git Bash)
scp -i droplet_2 aziz_bot.tar.gz root@165.232.136.50:/opt/

# 3. Dropletda ochib oling
ssh -i droplet_2 root@165.232.136.50
cd /opt
mkdir -p aziz_bot
tar -xzf aziz_bot.tar.gz -C aziz_bot
cd aziz_bot
rm /opt/aziz_bot.tar.gz
```

### 3️⃣ Environment sozlash

```bash
# Dropletda
cd /opt/aziz_bot

# .env yaratish
cp .env.example .env
nano .env
```

Quyidagi ma'lumotlarni to'ldiring:
```env
# Telegram Bot
BOT_TOKEN=6123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw  # @BotFather dan
BOT_USERNAME=your_bot_username

# Database (Local PostgreSQL in Docker)
DB_USER=azizbot
DB_PASSWORD=SuperStrongPassword123!@#  # O'zgartiring!
DB_NAME=aziz_bot_db
DB_HOST=postgres
DB_PORT=5432

# Database URL
DATABASE_URL=postgresql://azizbot:SuperStrongPassword123!@#@postgres:5432/aziz_bot_db?schema=public

# Application
NODE_ENV=production
PORT=3000

# Payme (agar kerak bo'lsa)
PAYME_MERCHANT_ID=your_merchant_id
PAYME_KEY=your_production_key
PAYME_TEST_KEY=your_test_key
PAYME_ENDPOINT=https://checkout.paycom.uz
```

Saqlash: **Ctrl+O**, **Enter**, **Ctrl+X**

### 4️⃣ Deploy qilish

```bash
# Dropletda
cd /opt/aziz_bot

# Script'ga ruxsat bering
chmod +x deploy.sh

# Deploy!
./deploy.sh
```

Bu jarayon:
- Docker image'larni build qiladi (~5-10 daqiqa)
- Database'ni ishga tushiradi
- Migration'larni bajaradi
- Bot'ni ishga tushiradi
- Log'larni ko'rsatadi

### 5️⃣ Tekshirish

```bash
# Konteynerlar statusini ko'ring
docker-compose ps

# Log'larni ko'ring
docker-compose logs -f app

# Health check
curl http://localhost:3000/health

# Bot'ga Telegram'dan xabar yuboring!
```

## 🔄 Keyingi yangilanishlar

### Local'dan tez deploy (Git Bash)
```bash
# Windowsda Git Bash da
./quick-deploy.sh "Feature qo'shildi"
```

### Dropletda manual yangilash
```bash
ssh -i droplet_2 root@165.232.136.50
cd /opt/aziz_bot
git pull origin main
docker-compose restart app
```

### Full rebuild
```bash
ssh -i droplet_2 root@165.232.136.50
cd /opt/aziz_bot
./deploy.sh
```

## 📊 Monitoring

### Log'larni kuzatish
```bash
# Real-time logs
docker-compose logs -f app

# Oxirgi 100 ta log
docker-compose logs --tail=100 app

# Xatolarni qidirish
docker-compose logs app | grep ERROR
```

### Resurslarni kuzatish
```bash
# Container'lar resurslari
docker stats

# Disk space
df -h

# Memory
free -m
```

## 🔧 Troubleshooting

### Bot ishlamayapti?
```bash
# Status
docker-compose ps

# Restart
docker-compose restart app

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database muammosi?
```bash
# Migration qayta ishlatish
docker-compose run --rm app pnpm prisma migrate deploy

# Database console
docker exec -it aziz_bot_postgres psql -U azizbot -d aziz_bot_db
```

### Disk to'lgan?
```bash
# Docker cache tozalash
docker system prune -a -f

# Log'larni o'chirish
rm -rf logs/*
```

## 💾 Backup

### Manual backup
```bash
# Database backup
docker exec aziz_bot_postgres pg_dump -U azizbot aziz_bot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Copy to local
scp -i droplet_2 root@165.232.136.50:/opt/aziz_bot/backup_*.sql ./backups/
```

## 🎯 Keyingi qadamlar

1. ✅ GitHub'ga push qilish
2. ✅ Droplet'ni sozlash
3. ✅ Bot'ni deploy qilish
4. 📱 Bot'ni test qilish
5. 🔔 Monitoring sozlash (Grafana/Prometheus)
6. 🔐 SSL sertifikat (Let's Encrypt)
7. 🌐 Domain ulash (agar kerak bo'lsa)

## 📞 Yordam

Agar muammo bo'lsa:
1. [DIGITAL_OCEAN_DEPLOYMENT.md](DIGITAL_OCEAN_DEPLOYMENT.md) - To'liq qo'llanma
2. [COMMANDS.md](COMMANDS.md) - Barcha buyruqlar
3. Log'larni tekshiring: `docker-compose logs app`

---

**Muvaffaqiyatli deploy!** 🎉
