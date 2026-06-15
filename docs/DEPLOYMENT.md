# Logstack Deployment Guide

This guide covers deploying Logstack to production environments.

## Prerequisites

- Docker and Docker Compose
- A domain name with DNS access
- SSL certificate (or use Let's Encrypt)
- SMTP service for emails (Resend recommended)
- Firebase project for push notifications (optional)

---

## Quick Start with Docker Compose

### 1. Clone and Configure

```bash
git clone https://github.com/mosesedem/logstack.git
cd logstack

# Copy environment file
cp .env.example .env
```

### 2. Edit Environment Variables

```bash
# .env file
POSTGRES_USER=logstack
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=logstack

JWT_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.com

RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@your-domain.com

# Optional: Firebase for push notifications
FCM_CREDENTIALS=<base64-encoded-service-account-json>

ALLOWED_ORIGINS=https://your-domain.com
```

### 3. SSL Certificates

Place your SSL certificates in `infra/nginx/ssl/`:

```bash
mkdir -p infra/nginx/ssl
cp /path/to/cert.pem infra/nginx/ssl/
cp /path/to/key.pem infra/nginx/ssl/
```

Or use Let's Encrypt:

```bash
# Install certbot
apt install certbot

# Get certificates
certbot certonly --standalone -d your-domain.com

# Copy to project
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem infra/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem infra/nginx/ssl/key.pem
```

### 4. Deploy

```bash
docker-compose up -d
```

### 5. Verify Deployment

```bash
# Check running containers
docker-compose ps

# Check logs
docker-compose logs -f

# Test health endpoint
curl https://your-domain.com/health
```

---

## Production Checklist

### Security

- [ ] Strong, unique passwords for PostgreSQL and Redis
- [ ] JWT_SECRET is cryptographically random (32+ bytes)
- [ ] NEXTAUTH_SECRET is cryptographically random
- [ ] SSL/TLS enabled with valid certificates
- [ ] ALLOWED_ORIGINS restricted to your domain
- [ ] Firewall configured (only ports 80, 443 exposed)
- [ ] Database not accessible from internet

### Performance

- [ ] PostgreSQL connection pooling configured
- [ ] Redis maxmemory and eviction policy set
- [ ] Nginx gzip compression enabled
- [ ] Appropriate rate limits set
- [ ] Log rotation configured

### Monitoring

- [ ] Health check endpoints monitored
- [ ] Disk space monitoring
- [ ] Database backup scheduled
- [ ] Error alerting configured

---

## Cloud Deployment Options

### AWS (EC2 + RDS + ElastiCache)

1. **EC2 Instance**
   - Recommended: t3.medium or larger
   - Ubuntu 22.04 LTS
   - Install Docker and Docker Compose

2. **RDS PostgreSQL**
   - PostgreSQL 16
   - db.t3.micro for development, db.t3.small+ for production
   - Enable automated backups

3. **ElastiCache Redis**
   - cache.t3.micro for development
   - Enable cluster mode for high availability

4. **Update Environment**
   ```bash
   DATABASE_URL=postgres://user:pass@your-rds-endpoint:5432/logstack
   REDIS_URL=redis://your-elasticache-endpoint:6379
   ```

### Google Cloud Platform

1. **Cloud Run** for API and Web
2. **Cloud SQL** for PostgreSQL
3. **Memorystore** for Redis

### DigitalOcean

1. **Droplet** (4GB+ RAM recommended)
2. **Managed PostgreSQL**
3. **Managed Redis**

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  api:
    deploy:
      replicas: 3
```

Use a load balancer (nginx, HAProxy, or cloud LB) to distribute traffic.

### Database Scaling

- Enable read replicas for query distribution
- Consider connection pooling with PgBouncer
- Implement table partitioning for logs table

### Redis Scaling

- Use Redis Cluster for high availability
- Configure appropriate maxmemory limits

---

## Backups

### PostgreSQL Backup

```bash
# Manual backup
docker exec logstack-postgres pg_dump -U logstack logstack > backup.sql

# Automated daily backup (crontab)
0 2 * * * docker exec logstack-postgres pg_dump -U logstack logstack | gzip > /backups/logstack-$(date +\%Y\%m\%d).sql.gz
```

### Restore

```bash
docker exec -i logstack-postgres psql -U logstack logstack < backup.sql
```

---

## Maintenance

### Log Rotation

Configure Docker log rotation in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

### Data Retention

Implement log cleanup for old data:

```sql
-- Delete logs older than 30 days
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Run as a cron job
0 3 * * * docker exec logstack-postgres psql -U logstack -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"
```

### Updates

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Or zero-downtime rolling update
docker-compose up -d --no-deps --build api
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs api

# Check resource usage
docker stats
```

### Database connection issues

```bash
# Test connection
docker exec -it logstack-postgres psql -U logstack

# Check if migrations ran
docker exec logstack-api cat /app/migrations/*.sql
```

### Redis connection issues

```bash
# Test connection
docker exec -it logstack-redis redis-cli ping
```

### WebSocket not connecting

- Ensure nginx is configured for WebSocket upgrade
- Check CORS settings in ALLOWED_ORIGINS
- Verify SSL certificates are valid

---

## Environment Variables Reference

| Variable          | Required | Description                     |
| ----------------- | -------- | ------------------------------- |
| `PORT`            | No       | API server port (default: 8080) |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string    |
| `REDIS_URL`       | Yes      | Redis connection string         |
| `JWT_SECRET`      | Yes      | Secret for JWT signing          |
| `RESEND_API_KEY`  | No       | Resend API key for emails       |
| `FROM_EMAIL`      | No       | Sender email address            |
| `FCM_CREDENTIALS` | No       | Base64 Firebase credentials     |
| `ALLOWED_ORIGINS` | Yes      | CORS allowed origins            |
| `NEXTAUTH_URL`    | Yes      | NextAuth callback URL           |
| `NEXTAUTH_SECRET` | Yes      | NextAuth encryption secret      |

---

## AWS EC2 + Docker Compose Deployment (Recommended for self-hosted prod)

This is the simplest path to a production deployment on AWS using plain EC2 + Docker (no Kubernetes required).

### 1. Launch EC2
- AMI: Amazon Linux 2023 or Ubuntu 22.04/24.04 LTS
- Instance type: t3.medium or larger (4 GB+ RAM recommended for DB + app)
- Security group: Allow 22 (SSH), 80, 443 from your IP / 0.0.0.0 (or put behind ALB + restrict)
- Storage: 20 GB+ gp3
- **User Data**: Paste the contents of `infra/aws/ec2-user-data.sh` (edit the script first with your real secrets or make it pull from SSM).

The script installs Docker + Compose plugin, clones the repo, creates a starter `.env`, and runs `docker compose up -d --build`.

After boot (~2-5 min):
```bash
ssh ec2-user@your-ec2-ip
cd /opt/logstack
docker compose ps
docker compose logs -f --tail 200
```

Test:
- `curl http://your-ec2-ip:3000` (web)
- `curl http://your-ec2-ip:8080/health`
- Open the dashboard, sign up, create project, rotate key, send logs via the JS SDK or curl.

### 2. Production Hardening on EC2
- Use an Elastic IP + Route53 domain.
- Put the instance behind an Application Load Balancer (ALB) for health checks + SSL termination (ACM certificate) or run nginx + certbot inside the compose stack (see infra/nginx).
- Mount persistent EBS for postgres volume (or move to RDS).
- For Redis, consider ElastiCache or keep the container + snapshot volumes.
- Secrets: Enhance the user-data script to `aws ssm get-parameter ...` or use Docker secrets / env files from S3 + KMS.
- Logging: `docker compose logs` → ship to CloudWatch Logs or an external service.
- Updates: `git pull && docker compose up -d --build`

### 3. CDN with CloudFront (for static assets & performance)
The Next.js web app (built with `output: "standalone"`) already serves its own hashed static files from `/_next/static/*`.

**Recommended CloudFront setup (works great in front of EC2 or ALB):**

1. Create a CloudFront distribution.
2. Origin: Your ALB / EC2 public DNS (or the nginx container port).
3. Cache behaviors (ordered):
   - Path: `/_next/static/*` → Cache policy "CachingOptimized", TTL 1 year, "Immutable" response headers. Forward no query strings / cookies.
   - Path: `/*.ico`, `/*.png`, `/*.svg`, other public static → long cache (30 days+).
   - Default or `/v1/*`, `/api/*`, WebSocket (`/ws` or `/v1/stream`) → **Cache policy: CachingDisabled** (or "Managed-CachingDisabled"), forward all headers, cookies, query strings. Origin request policy that includes Host, Origin, etc.
4. (Optional) Alternate domain (CNAME) + ACM cert in us-east-1.
5. In the web app (baked at build or via env):
   - Set `NEXT_PUBLIC_CDN_URL=https://your-cloudfront-domain.cloudfront.net` (no trailing slash).
   - The `apps/web/next.config.mjs` already reads `assetPrefix` from it (affects JS/CSS chunks and some asset references).
6. Invalidate CloudFront when you deploy new web assets (or use versioned filenames which Next already does).

Benefits: Dramatically faster first load for dashboard/landing/docs, reduced origin traffic, better global latency.

See also `infra/nginx/nginx.conf` (we added strong `Cache-Control: immutable` + long max-age for `/_next/static` and other assets).

### 4. Full-stack docker-compose on EC2
The root `docker-compose.yml` now includes a `web` service (in addition to `api` + databases). This lets you run the entire product with one command on a single EC2 host:

```bash
docker compose up -d --build
```

- Web is on port 3000 (internal)
- API on 8080
- For a single public port, front both with the nginx container or the ALB (recommended).

Set the public `NEXT_PUBLIC_*_URL` values to your final domain **before** building the web image (they are compile-time for the browser bundle).

### 5. Quick production compose tips
You can create a `docker-compose.prod.yml` override:

```yaml
# docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
services:
  web:
    environment:
      NEXT_PUBLIC_API_URL: https://api.logstack.tech/v1
      # ...
  api:
    environment:
      ENV: production
      # ...
```

Combine with the user-data script or a small deploy script that does `git pull`, `docker compose pull --ignore-pull-failures || true`, `docker compose up -d --build --remove-orphans`.

Update `docs/progress.md` and this file after any production changes.

**You are now ready to launch a full Logstack environment on AWS EC2 with Docker + optional CloudFront CDN.** Test the flow (signup → project → SDK log → dashboard + mobile) on the instance before cutting over DNS.
