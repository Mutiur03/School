#docker network create school_network

docker compose  -f backend-run.yml down
docker system df
docker compose  -f backend-run.yml up -d --build
docker exec school_backend npm run build
docker system df
docker compose  -f backend-run.yml logs -f
docker system prune -a -f
docker builder prune -f
docker system df