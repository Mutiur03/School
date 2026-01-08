#!/bin/bash

echo "Starting School Management System Backend..."

# Wait for database to be ready
echo "Waiting for database connection..."
until npx prisma db push --accept-data-loss > /dev/null 2>&1; do
  echo "Database not ready, waiting 2 seconds..."
  sleep 2
done

echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed the database (optional, will not fail if already seeded)
echo "Seeding database..."
npx prisma db seed || echo "Seeding completed or skipped"

echo "Starting the server with PM2..."
# Start the server with PM2
exec pm2-runtime server.js -i max