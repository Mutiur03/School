#!/bin/bash
# Usage: ./start-db.sh .env.client1

# Check if env file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 path-to-env-file"
  exit 1
fi

ENV_FILE="$1"

# Extract project name from env file (strip path & .env prefix)
PROJECT_NAME=$(basename "$ENV_FILE")
PROJECT_NAME="${PROJECT_NAME#.env.}"

echo "Starting Redis for project: $PROJECT_NAME using env: $ENV_FILE"

# Setup network first
./setup-network.sh "$ENV_FILE"

# Start the container using docker compose
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f redis-run.yml up -d --build

echo "✅ Redis container started for $PROJECT_NAME"
