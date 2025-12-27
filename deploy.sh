#!/bin/bash

# Digital Ocean deployment script for Aziz Bot

set -e

echo "🚀 Starting deployment..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Stop existing containers
echo "⏹️  Stopping existing containers..."
docker-compose down

# Remove old images
echo "🗑️  Removing old images..."
docker image prune -f

# Build new images
echo "🔨 Building new images..."
docker-compose build --no-cache

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose run --rm app pnpm prisma migrate deploy

# Start services
echo "▶️  Starting services..."
docker-compose up -d

# Show logs
echo "📋 Showing logs..."
docker-compose logs -f --tail=100
