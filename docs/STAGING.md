# CodePRO LK staging server

The staging stack runs beside production but uses separate containers, ports,
credentials, and PostgreSQL storage. Staging quiz activity cannot modify the
production database.

## Network layout

| Service | Production | Staging |
| --- | --- | --- |
| Frontend | `5173` | `127.0.0.1:5174` |
| Backend | `8000` | `127.0.0.1:8001` |
| PostgreSQL | `5432` | `127.0.0.1:5433` |
| Compose project | default | `codeprolk-staging` |
| Database volume | `postgres_data` | `staging_postgres_data` |

Only Nginx is public. The staging ports bind to localhost on the VM.

## First-time VM setup

Point the DNS `A` record for `staging.codeprolk.com` to the production VM. Keep
staging in a second checkout so testing a branch never changes the production
working tree:

```bash
cd /opt
git clone --branch server-setup https://github.com/codeprolk/codeprolk.git codeprolk-staging
cd /opt/codeprolk-staging

cp backend/.env.staging.example backend/.env.staging
nano backend/.env.staging
```

Generate independent secrets rather than reusing production values:

```bash
openssl rand -hex 24
openssl rand -base64 48
```

The first value can be used for `POSTGRES_PASSWORD`; update the password in
both `POSTGRES_PASSWORD` and `DATABASE_URL`. Use the second for `JWT_SECRET`.

Install the Nginx site and create the shared staging password:

```bash
sudo apt-get update
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-codeprolk-staging codeprolk-review
sudo cp deploy/nginx/staging.codeprolk.com.conf /etc/nginx/sites-available/staging.codeprolk.com
sudo ln -s /etc/nginx/sites-available/staging.codeprolk.com /etc/nginx/sites-enabled/staging.codeprolk.com
sudo nginx -t
sudo systemctl reload nginx
```

Build and start staging without touching production:

```bash
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=100 backend frontend
```

After the HTTP site responds, issue the TLS certificate:

```bash
sudo certbot --nginx -d staging.codeprolk.com
```

Open `https://staging.codeprolk.com` and enter the Nginx review credentials,
then sign in with the staging admin account configured in `.env.staging`.

## Routine staging updates

```bash
cd /opt/codeprolk-staging
git pull origin server-setup
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
```

## Useful operations

```bash
# Follow staging logs
docker compose -f docker-compose.staging.yml logs -f backend frontend

# Restart staging only
docker compose -f docker-compose.staging.yml restart

# Stop staging while retaining its database
docker compose -f docker-compose.staging.yml down

# Start it again
docker compose -f docker-compose.staging.yml up -d
```

Do not add `-v` to `docker compose down`; that would delete the isolated staging
database volume. Keep SMTP empty unless staging email delivery is intentional.
