#!/bin/bash
set -e

echo "Starting School Management System Backend..."

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=${4:-30}
    local attempt=0
    
    echo "Waiting for $service_name at $host:$port..."
    while [ $attempt -lt $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "$service_name is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "Attempt $attempt/$max_attempts: $service_name not ready, waiting 2 seconds..."
        sleep 2
    done
    
    echo "ERROR: $service_name failed to become ready after $max_attempts attempts"
    exit 1
}

# Install netcat if not available (for service checks)
if ! command -v nc &> /dev/null; then
    echo "Installing netcat for service checks..."
    apt-get update && apt-get install -y netcat-traditional
fi

# Extract database connection details from DATABASE_URL if available
if [ -n "$DATABASE_URL" ]; then
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*:\/\/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\/\/.*@[^:]*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*:\/\/.*@[^:]*:[0-9]*\/\([^?]*\).*/\1/p')
else
    # Fallback to environment variables
    DB_HOST=${POSTGRES_HOST:-postgres_school}
    DB_PORT=${POSTGRES_PORT:-5432}
    DB_USER=${POSTGRES_USER:-postgres}
    DB_NAME=${POSTGRES_DB:-school}
fi

# Wait for database to be ready
wait_for_service "$DB_HOST" "$DB_PORT" "PostgreSQL Database"

# Additional database readiness check using pg_isready if available
if command -v pg_isready &> /dev/null; then
    echo "Performing detailed database readiness check..."
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
        echo "Database detailed check not ready, waiting 2 seconds..."
        sleep 2
    done
    echo "Database detailed check passed!"
fi

# Wait for Redis if configured
if [ -n "$REDIS_URL" ] || [ -n "$REDIS_HOST" ]; then
    REDIS_HOST_TO_CHECK=${REDIS_HOST:-school_redis}
    REDIS_PORT_TO_CHECK=${REDIS_PORT:-6379}
    wait_for_service "$REDIS_HOST_TO_CHECK" "$REDIS_PORT_TO_CHECK" "Redis Cache"
fi

# Generate Prisma client (in case it's not generated during build)
echo "Generating Prisma client..."
npx prisma generate || echo "Prisma client generation failed or already exists"

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed the database (optional, will not fail if already seeded)
echo "Seeding database..."
npx prisma db seed || echo "Seeding completed or skipped"

# Verify server file exists
if [ ! -f "server.js" ]; then
    echo "ERROR: server.js not found in the current directory"
    ls -la
    exit 1
fi

echo "Starting the server with PM2..."
# Start the server with PM2 in cluster mode
exec pm2-runtime start server.js -i max --name "school-backend"