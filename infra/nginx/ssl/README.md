# Placeholder SSL Certificate

This directory should contain your SSL certificate files:

- `cert.pem` - SSL certificate
- `key.pem` - Private key

## Development

For development, you can generate self-signed certificates:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
```

## Production

Use Let's Encrypt or your certificate provider:

```bash
# Using certbot
certbot certonly --standalone -d your-domain.com

# Copy certificates
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./key.pem
```
