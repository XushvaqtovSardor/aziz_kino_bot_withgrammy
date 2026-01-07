# Railway Deployment Quick Start

## 🚀 Deploy in 3 Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Railway deployment"
git push origin main
```

### 2. Deploy on Railway
- Go to [railway.app](https://railway.app)
- Click "New Project" → "Deploy from GitHub repo"
- Select this repository
- Railway auto-detects and deploys!

### 3. Setup Environment
Add these variables in Railway dashboard:
```
BOT_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
```

Railway automatically provides `DATABASE_URL` when you add PostgreSQL.

## Add PostgreSQL Database
In Railway project:
- Click "New" → "Database" → "PostgreSQL"
- Done! `DATABASE_URL` is auto-configured

## Check Deployment
- View logs in Railway dashboard
- Test health: `https://your-app.railway.app/health`
- Bot should start automatically

## Full Guide
See [RAILWAY.md](./RAILWAY.md) for detailed instructions.

---

**That's it!** Your bot is deployed on Railway. 🎉
