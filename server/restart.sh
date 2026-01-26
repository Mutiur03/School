if [ -z "$1" ]; then
  echo "Usage: $0 path-to-env-file [--no-build] [--no-logs]"
  exit 1
fi

ENV_FILE="$1"
PROJECT_NAME=$(basename "$ENV_FILE")
PROJECT_NAME="${PROJECT_NAME#.env.}"
echo "Restarting backend for project: $PROJECT_NAME using env: $ENV_FILE"

# Check for flags
NO_BUILD=""
NO_LOGS=false

for arg in "$@"; do
  if [ "$arg" == "--no-build" ]; then
    NO_BUILD="true"
  fi
  if [ "$arg" == "--no-logs" ]; then
    NO_LOGS=true
  fi
done

# Setup network first
./setup-network.sh "$ENV_FILE"

docker system df

if [ "$NO_BUILD" == "true" ]; then
  echo "🚀 Starting without build..."
  ENV_FILE="$ENV_FILE" docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f backend-run.yml up -d
else
  echo "🔨 Building and starting..."
  ENV_FILE="$ENV_FILE" docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f backend-run.yml up -d --build
fi

# Database migrations and seeding are now handled by docker-entrypoint.sh
docker system df

if [ "$NO_LOGS" = false ]; then
  ENV_FILE="$ENV_FILE" docker compose  -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f backend-run.yml logs -f
fi

docker system df