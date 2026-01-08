if [ -z "$1" ]; then
  echo "Usage: $0 path-to-env-file"
  exit 1
fi

ENV_FILE="$1"
PROJECT_NAME=$(basename "$ENV_FILE")
PROJECT_NAME="${PROJECT_NAME#.env.}"
echo "Restarting backend for project: $PROJECT_NAME using env: $ENV_FILE"

# Setup network first
./setup-network.sh "$ENV_FILE"

#docker network create school_network

#docker compose  -f backend-run.yml down
docker system df
ENV_FILE="$ENV_FILE" docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f backend-run.yml up -d --build
# Database migrations and seeding are now handled by docker-entrypoint.sh
docker system df

ENV_FILE="$ENV_FILE" docker compose  -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f backend-run.yml logs -f
# docker system prune -a -f
# docker builder prune -f
docker system df