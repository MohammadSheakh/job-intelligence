Your `compose.neon.yaml` and Docker setup have been successfully configured.

### Changes made

1. **Redis host port isolation (`compose.neon.yaml`)**

   * Removed the Redis host port mapping (`6379:6379`).
   * Redis is now only accessible inside the Docker internal network, so external devices or other machines on the LAN cannot connect to Redis directly.

2. **Localhost loopback binding (`compose.neon.yaml`)**

   * Changed the backend and frontend port bindings from `0.0.0.0` to `127.0.0.1`.
   * The bindings are now:

     ```yaml
     127.0.0.1:4000:4000
     127.0.0.1:3000:3000
     ```
   * This means `http://localhost:3000` and `http://localhost:4000` still work on your own PC, but other devices on your Wi-Fi/LAN cannot directly access those ports.

3. **Added a `cloudflared` container service (`compose.neon.yaml`)**

   * Added the official `cloudflare/cloudflared:latest` image as a service in the same Docker network.
   * The tunnel can route traffic internally using Docker service names such as:

     ```text
     http://frontend:3000
     http://backend:4000
     ```

4. **Next.js client URL build support (`frontend/Dockerfile`)**

   * Added:

     ```dockerfile
     ARG NEXT_PUBLIC_API_URL
     ```
   * This allows the public Cloudflare API domain, or another API URL, to be injected correctly into the Next.js client bundle during the Docker build.

5. **Environment variable documentation (`.env.example`)**

   * Added:

     ```env
     CLOUDFLARE_TUNNEL_TOKEN=
     ```

### Next steps

Add your Cloudflare Tunnel token to your `.env` file:

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJh...your_token...
```

Optionally, configure your public URLs:

```env
FRONTEND_ORIGIN=https://jobs.yourdomain.com
COOKIE_SECURE=true
NEXT_PUBLIC_API_URL=https://api.jobs.yourdomain.com/api/v1
```

Then rebuild and start the containers:

```bash
docker compose -f compose.neon.yaml up --build -d
```

To monitor the Cloudflare Tunnel connection:

```bash
docker compose -f compose.neon.yaml logs -f cloudflared
```

After the tunnel connects successfully, it should appear as **Healthy** in the Cloudflare Dashboard.

The setup was also checked with Docker Compose validation, the PRD audit, backend tests, and database tests before reviewing the final Git diff/status.
