# Docker Reverse Proxy Automation (Real Backend)

This setup uses `nginx-proxy` and `acme-companion` to host multiple backend instances (e.g., for different schools) on a single server with automatic SSL.

## 1. Start the Global Reverse Proxy

Run this once on your server:

```bash
cd docker-proxy
docker compose up -d
```

This creates the `proxy-nw` network and starts the reverse proxy on ports 80 and 443.

## 2. Deploy a Backend Instance

To deploy a backend instance (e.g., for a specific school):

1.  **Configure environment**: Ensure your `server/.env` has the following variables (or pass them via command line):
    - `VIRTUAL_HOST`: The domain for this instance (e.g., `school1.example.com`).
    - `ADMIN_EMAIL`: Email for Let's Encrypt certificate.
    - `school_name`: A unique identifier for this instance (e.g., `school1`).
    - `PORT`: The internal port the app listens on (default is 3001).

2.  **Run the instance**:
    You can run multiple instances from the same directory using different project names and environment variables:

    ```bash
    # Example for School 1
    VIRTUAL_HOST=school1.com ADMIN_EMAIL=user@test.com school_name=school1 \
    docker compose -p school1 -f server/docker-compose.yml up -d

    # Example for School 2
    VIRTUAL_HOST=school2.com ADMIN_EMAIL=user@test.com school_name=school2 \
    docker compose -p school2 -f server/docker-compose.yml up -d
    ```

## 3. How it Works

- **Automatic Routing**: `nginx-proxy` detects the new containers on the `proxy-nw` network and generates Nginx configurations based on the `VIRTUAL_HOST`.
- **Automatic SSL**: `acme-companion` sees the `LETSENCRYPT_HOST` (derived from `VIRTUAL_HOST`) and automatically requests/renews certificates.
- **Isolation**: Each instance gets its own internal network (`${school_name}_internal`) for its database and redis, ensuring they don't interfere with each other.

## Common Mistakes to Avoid

- **DNS Records**: Make sure `VIRTUAL_HOST` points to the server IP before starting the container.
- **Project Names**: Always use `-p [unique_name]` when running multiple instances from the same compose file, otherwise Docker will try to overwrite the existing instance.
- **Resource Limits**: Ensure your server has enough RAM/CPU if you plan to run many instances of Node.js + Postgres + Redis.
