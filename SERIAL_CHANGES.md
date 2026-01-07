
# 1. Dropletga ulanish
ssh root@your_droplet_ip

# 2. Docker o'rnatish
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install docker-compose-plugin -y

# 3. Repository clone qilish
cd /opt
git clone <your-repo>
cd aziz_bot_grammy

# 4. Environment sozlash
cp .env.example .env
nano .env  # Tokenlaringizni kiriting

# 5. Deploy qilish
chmod +x deploy.sh
./deploy.sh




BOT_TOKEN=6123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
BOT_USERNAME=YourBotUsername
DB_PASSWORD=strong_password_123
DATABASE_URL=postgresql://azizbot:strong_password_123@postgres:5432/aziz_bot_db?schema=public


make docker-up      # Start services
make docker-logs    # View logs
make docker-down    # Stop services
make deploy         # Full deployment
make backup-db      # Backup database
make monitor-up     # Start monitoring