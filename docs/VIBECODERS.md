# Vibecoders: AI-Powered Log Analysis Integration

Integrate Logstack with Vibecoders for intelligent, AI-powered log analysis and insights.

## Overview

Logstack provides a structured logging API that integrates seamlessly with Vibecoders for automated anomaly detection, performance analysis, and intelligent alerting. Send your application logs to Logstack, and let Vibecoders analyze patterns and recommend optimizations.

## Quick Integration

### 1. Initialize Logstack Client

```javascript
import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY,
  environment: "production",
  // Enable AI metadata tagging for Vibecoders
  metadata: {
    service: "my-app",
    version: "1.0.0",
    team: "backend",
  },
});
```

### 2. Send Structured Logs

```javascript
// Log with context for AI analysis
await logstack.info("User subscription updated", {
  userId: "user_123",
  plan: "pro_monthly",
  revenue: 2900,
  source: "api:POST:/v1/subscriptions",
  duration_ms: 245,
  status: "success",
});

await logstack.error("Payment processing failed", {
  userId: "user_456",
  amount: 9900,
  provider: "paystack",
  error: "invalid_card",
  retry_count: 2,
  source: "worker:payment-processor",
});
```

### 3. Set Up Alert Rules for AI Insights

```bash
# Enable Vibecoders anomaly detection via API
POST /v1/alerts

{
  "name": "Vibecoders: Payment Failure Spike",
  "triggerPattern": "error.*payment",
  "triggerLevel": "error",
  "channel": "webhook",
  "recipient": "https://api.vibecoders.io/webhooks/logstack",
  "cooldownMinutes": 5
}
```

## Log Metadata Best Practices

### Required Fields for AI Analysis

### Recommended Fields

```javascript
const context = {
  // Business
  plan: "pro_monthly",
  revenue: 2900,
  currency: "NGN",

  // Technical
  source: "api:POST:/v1/checkout",
  duration_ms: 245,
  database_queries: 3,
  cache_hits: 2,

  // Environment
  region: "us-east-1",
  deployment: "production",
  instance_id: "pod-7a3f2c1b",
};
```

## Vibecoders Analysis Examples

### Anomaly Detection

Vibecoders automatically identifies when error rates spike:

```json
{
  "alert": "Anomaly detected",
  "metric": "error_rate",
  "baseline": "2.1%",
  "current": "18.7%",
  "change": "+789%",
  "duration": "15 minutes",
  "source_patterns": ["payment.*", "stripe.*"],
  "recommendation": "Check payment provider status or database connectivity"
}
```

### Performance Degradation

Automatic detection of latency increases:

```json
{
  "alert": "Performance degradation",
  "endpoint": "POST /v1/logs",
  "p50_latency_ms": 240,
  "p95_latency_ms": 890,
  "p99_latency_ms": 2100,
  "increase_vs_baseline": "+340%",
  "affected_users": 2400,
  "recommendation": "Scale API replicas or optimize database queries"
}
```

### Business Impact Analysis

Correlate logs with business metrics:

```json
{
  "insight": "Revenue impact",
  "failed_checkouts": 340,
  "recovery_rate": "62%",
  "lost_revenue": "₦8,500,000",
  "root_cause": "Payment provider timeout (3-second SLA breach)",
  "action_items": [
    "Add retry logic with exponential backoff",
    "Implement circuit breaker for payment provider",
    "Set up 24/7 oncall for payment service"
  ]
}
```

## Webhook Configuration

### Receive Vibecoders Insights

Configure your application to receive AI-generated insights:

```javascript
// api/webhooks/vibecoders.ts
export async function POST(req: Request) {
  const insight = await req.json();

  // Insight types: anomaly, performance, business, security
  console.log(`[${insight.type}] ${insight.alert}`);
  console.log(`Impact: ${insight.recommendation}`);

  // Route to appropriate team
  if (insight.type === 'business') {
    await notifyBusinessTeam(insight);
  } else if (insight.type === 'security') {
    await escalateToSecurityTeam(insight);
  } else {
    await notifyEngineeringTeam(insight);
  }
}
```

## Real-World Example: E-Commerce Platform

### Scenario

Your payment processing is experiencing degradation, but you need to understand the impact across your system.

### Step 1: Instrument Payment Flow

```javascript
const startTime = Date.now();

try {
  const result = await processPayment({
    userId: req.user.id,
    amount: req.body.amount,
    provider: "paystack",
  });

  await logstack.info("Payment processed", {
    userId: req.user.id,
    amount: req.body.amount,
    provider: "paystack",
    duration_ms: Date.now() - startTime,
    status: "success",
    source: "api:POST:/v1/checkout",
    transaction_id: result.id,
  });

  res.json({ success: true, transaction_id: result.id });
} catch (error) {
  await logstack.error("Payment failed", {
    userId: req.user.id,
    amount: req.body.amount,
    provider: "paystack",
    error: error.message,
    duration_ms: Date.now() - startTime,
    status: "failed",
    source: "api:POST:/v1/checkout",
  });

  res.status(400).json({ error: error.message });
}
```

### Step 2: Vibecoders Analyzes

Logstack sends logs to Vibecoders, which detects:

### Step 3: Automated Response

Vibecoders sends insight webhook:

```json
{
  "type": "business",
  "alert": "Revenue impact: ₦24M lost",
  "root_cause": "Payment provider timeout",
  "recommendation": "Implement retry logic and circuit breaker",
  "automated_actions": [
    "Escalated to on-call engineer",
    "Disabled affected payment method temporarily",
    "Notified customer success of affected users"
  ]
}
```

## API Reference

### Send Log with AI Context

```bash
POST /v1/logs

Content-Type: application/json
Authorization: Bearer {LOGSTACK_API_KEY}

{
  "level": "error",
  "message": "Payment processing failed",
  "metadata": {
    "userId": "user_123",
    "amount": 9900,
    "provider": "paystack",
    "error": "timeout",
    "source": "worker:payment-processor",
    "duration_ms": 5200,
    "retry_count": 2
  },
  "timestamp": "2026-05-05T14:30:45Z"
}
```

### Create AI-Powered Alert Rule

```bash
POST /v1/alerts

{
  "name": "Vibecoders: High Error Rate",
  "triggerPattern": "error",
  "triggerLevel": "error",
  "channel": "webhook",
  "recipient": "https://api.vibecoders.io/webhooks/logstack",
  "cooldownMinutes": 5,
  "enabled": true
}
```

## Best Practices

1. **Always include context**: Never send bare log messages; include source, userId, duration, and status
2. **Use consistent source naming**: Format as `layer:operation` (e.g., `api:POST:/v1/logs`, `worker:daily-digest`)
3. **Track business metrics**: Include revenue, user count, and plan info for business impact analysis
4. **Set reasonable cooldown**: Prevent alert fatigue with 5-30 minute cooldown periods
5. **Monitor webhook delivery**: Ensure Vibecoders webhooks are successfully received and processed

## Troubleshooting

### Insights Not Received

### Inaccurate Anomaly Detection

### High False Positive Rate

## Support
