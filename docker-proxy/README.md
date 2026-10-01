# Docker reverse proxy (optional)

These services require access to the Docker socket to discover upstream containers. They are **not** started by default.

```bash
docker compose --profile docker-proxy up -d
```

Without the profile, `docker compose up` does not mount `/var/run/docker.sock`.
