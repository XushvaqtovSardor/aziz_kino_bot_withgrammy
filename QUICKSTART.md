# Quick Start Guide

## Local Development

### 1. Setup

```bash
# Clone repository
git clone <your-repo>
cd aziz_bot_grammy

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Start Development Server

```bash
# Make script executable
chmod +x start-dev.sh

# Run
./start-dev.sh
```

Or manually:
```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm start:dev
```

## Docker Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Digital Ocean deployment instructions.

### Quick Deploy

```bash
# On your Digital Ocean droplet
git clone <your-repo>
cd aziz_bot_grammy
cp .env.example .env
nano .env  # Update credentials
chmod +x deploy.sh
./deploy.sh
```

## Environment Variables

Required:
- `BOT_TOKEN` - Get from @BotFather
- `BOT_USERNAME` - Your bot username (without @)
- `DATABASE_URL` - PostgreSQL connection string
- `DB_PASSWORD` - Strong database password

## Project Structure

```
aziz_bot_grammy/
├── src/
│   ├── modules/
│   │   ├── admin/          # Admin panel and handlers
│   │   ├── user/           # User handlers
│   │   ├── content/        # Movies and serials
│   │   ├── field/          # Field channels
│   │   ├── payment/        # Payment processing
│   │   └── ...
│   ├── common/             # Shared utilities
│   ├── prisma/             # Database client
│   └── main.ts             # Application entry point
├── prisma/
│   └── schema.prisma       # Database schema
├── docker-compose.yml      # Docker services
├── Dockerfile              # Application container
└── deploy.sh               # Deployment script
```

## Useful Commands

```bash
# Development
pnpm start:dev              # Start with hot reload
pnpm build                  # Build for production
pnpm start:prod             # Start production build

# Database
pnpm prisma studio          # Open database GUI
pnpm prisma migrate dev     # Create new migration
pnpm prisma migrate deploy  # Apply migrations in production
pnpm prisma db push         # Push schema without migration

# Docker
docker compose up -d        # Start services
docker compose down         # Stop services
docker compose logs -f      # View logs
docker compose restart      # Restart services

# Testing
pnpm test                   # Run tests
pnpm test:watch            # Run tests in watch mode
pnpm test:cov              # Run tests with coverage
```

## Features

- 🎬 Movie management
- 📺 Serial management with episodes
- 📁 Field channels organization
- 💎 Premium subscriptions
- 💳 Payment integration (Payme, Click)
- 👥 Admin panel with roles
- 📊 Statistics and analytics
- 🔔 Broadcasting messages
- 📤 Share functionality with inline queries

## Tech Stack

- **Framework**: NestJS
- **Bot Library**: Grammy
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Runtime**: Node.js 20
- **Deployment**: Docker + Docker Compose
