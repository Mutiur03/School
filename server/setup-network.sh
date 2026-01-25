#!/bin/bash
# Usage: ./setup-network.sh .env.client1

# Check if env file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 path-to-env-file"
  exit 1
fi

ENV_FILE="$1"

# Source the environment file to get school_name
if [ ! -f "$ENV_FILE" ]; then
  echo "Environment file $ENV_FILE not found!"
  exit 1
fi

# Extract school_name from env file
SCHOOL_NAME=$(grep "^school_name=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')

if [ -z "$SCHOOL_NAME" ]; then
  echo "school_name not found in $ENV_FILE"
  exit 1
fi

# Check if global proxy network exists
if docker network ls | grep -q "proxy-nw"; then
  echo "✅ Global network proxy-nw already exists"
else
  echo "🔨 Creating global network: proxy-nw"
  docker network create "proxy-nw" --driver bridge
  echo "✅ Global network proxy-nw created successfully"
fi

NETWORK_NAME="${SCHOOL_NAME}_school_network"

# Check if network already exists
if docker network ls | grep -q "$NETWORK_NAME"; then
  echo "✅ Network $NETWORK_NAME already exists"
else
  echo "🔨 Creating network: $NETWORK_NAME"
  docker network create "$NETWORK_NAME" --driver bridge
  echo "✅ Network $NETWORK_NAME created successfully"
fi