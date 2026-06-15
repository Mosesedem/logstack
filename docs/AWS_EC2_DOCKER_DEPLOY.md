# AWS EC2 Docker Deploy

This guide is for the common case where Logstack is already running on an AWS EC2 instance with Docker Compose, and you want to push a new version without rebuilding the whole setup from scratch.

It assumes:

- Your app is running on one EC2 host.
- The code lives in a working directory such as `/opt/logstack`.
- Docker and Docker Compose are already installed.
- Your production `.env` file already exists on the server.

## 1. First-time host setup

If the instance is new, SSH in and clone the repo once:

```bash
ssh ec2-user@YOUR_EC2_HOST
cd /opt
git clone https://github.com/Mosesedem/logstack.git logstack
cd /opt/logstack
```

Copy your production env file into place and make sure secrets are real, not placeholder values:

```bash
cp /path/to/your/.env /opt/logstack/.env
```

Start the stack:

```bash
docker compose up -d --build
```

## 2. Deploying a new release

When you have already pushed code to GitHub and want the EC2 host to pick it up:

```bash
ssh ec2-user@YOUR_EC2_HOST
cd /opt/logstack
git pull --ff-only origin main
docker compose up -d --build --remove-orphans
```

That is the standard update flow for this repo because the compose file builds the app images from the checked-out source.

If you only changed the backend:

```bash
docker compose up -d --build api
```

If you only changed the web app:

```bash
docker compose up -d --build web
```

If you changed shared environment variables or Dockerfiles, rebuild the full stack:

```bash
docker compose up -d --build --remove-orphans
```

## 3. Verify the deploy

Check container health and recent logs:

```bash
docker compose ps
docker compose logs -f --tail 200 api web
```

Then test the public endpoints:

```bash
curl http://YOUR_EC2_HOST:8080/health
curl http://YOUR_EC2_HOST:3000
```

If you front the instance with nginx or an ALB, use the public domain instead of the raw host.

## 4. Safer deploys

Before a risky change, take a database backup:

```bash
docker exec logstack-postgres pg_dump -U logstack logstack > backup.sql
```

If something looks wrong after the update, roll back by checking out the previous commit and bringing the stack back up:

```bash
git checkout PREVIOUS_COMMIT_SHA
docker compose up -d --build --remove-orphans
```

## 5. Common gotchas

- Make sure the `.env` file on the server still has the final production values.
- If browser clients break after a deploy, confirm `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` still point at the public AWS URL, not `localhost`.
- If database migrations were added, run them before or during the deploy window.
- If the instance uses CloudFront or nginx, clear or refresh the cache for any changed static assets.

## 6. One-line deploy command

If you just want the shortest possible update flow, use:

```bash
ssh ec2-user@YOUR_EC2_HOST 'cd /opt/logstack && git pull --ff-only origin main && docker compose up -d --build --remove-orphans'
```

That is the default path for pushing a new version to an existing Docker host on AWS.
