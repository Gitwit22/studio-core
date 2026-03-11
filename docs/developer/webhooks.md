# Webhooks

StreamLine uses webhooks for event-driven integrations with external services. This document covers both inbound webhooks (events StreamLine receives) and outbound webhooks (events StreamLine sends).

## Inbound Webhooks

### Stripe Webhooks

**Endpoint:** `POST /api/webhooks/stripe`

Stripe sends webhook events to notify StreamLine of payment and subscription changes. The webhook endpoint verifies the Stripe signature before processing.

> **Important**: The Stripe webhook route is registered _before_ the JSON body parser in the middleware stack. This is required because Stripe signature verification needs the raw request body.

#### Events Handled

| Event | Description | Action |
|---|---|---|
| `customer.subscription.created` | New subscription activated | Update user's plan ID and billing truth in Firestore |
| `customer.subscription.updated` | Plan change (upgrade/downgrade) | Reflect new plan status; apply scheduled changes |
| `customer.subscription.deleted` | Subscription canceled | Revert user to Free plan |
| `invoice.paid` | Payment succeeded | Confirm billing state |
| `invoice.payment_failed` | Payment failed | Flag billing issue on user account |

#### Webhook Flow

```
Stripe → POST /api/webhooks/stripe
                │
                ├── Verify Stripe signature (raw body)
                │
                ├── Parse event type
                │
                ├── Match event to handler
                │
                └── Update Firestore user document
                    (planId, billingTruth, stripeCustomerId,
                     scheduledPlanChange)
```

#### Configuration

| Environment Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (for signature verification) |

#### Subscription Lifecycle via Webhooks

1. **User initiates checkout** → `POST /api/billing/checkout` creates Stripe session
2. **User completes payment** → Stripe fires `customer.subscription.created`
3. **Webhook updates user** → User document updated with new plan and Stripe customer ID
4. **Plan change** → Stripe fires `customer.subscription.updated`
5. **Scheduled downgrade** → Applied at end of billing period via `scheduledPlanChange` field
6. **Cancellation** → Stripe fires `customer.subscription.deleted`, user reverts to Free

---

## Outbound Webhooks

### Horizon Event Webhooks

StreamLine forwards room events to the Horizon AI agent service via outbound webhooks.

#### Chat Events

**Outbound URL:** Configured via `HORIZON_CHAT_EVENT_URL`

When a chat message is sent in a room, StreamLine can forward the message to Horizon for AI processing.

**Payload:**
```json
{
  "type": "chat_event",
  "roomId": "room-id",
  "identity": "user-identity",
  "message": "hey horizon, summarize this meeting",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### Voice Events

**Outbound URL:** Configured via `HORIZON_VOICE_EVENT_URL`

Voice commands detected in a room can be forwarded to Horizon for processing.

**Payload:**
```json
{
  "type": "voice_event",
  "roomId": "room-id",
  "identity": "user-identity",
  "command": "start recording",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### Authentication

Outbound webhooks include a Bearer token for authentication:

```
Authorization: Bearer <HORIZON_WEBHOOK_SECRET>
```

The receiving service verifies the token using `verifyHorizonSecret()`.

#### Retry Logic

| Setting | Default | Description |
|---|---|---|
| `HORIZON_WEBHOOK_TIMEOUT` | 5000ms | Per-request timeout |
| `HORIZON_WEBHOOK_RETRIES` | 2 | Max retries on 5xx responses |

Failed requests are retried automatically on 5xx server errors. Client errors (4xx) are not retried.

#### Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `HORIZON_CHAT_EVENT_URL` | Chat event webhook endpoint | `http://10.0.0.27:3000/api/streamline/chat-event` |
| `HORIZON_VOICE_EVENT_URL` | Voice event webhook endpoint | `http://10.0.0.27:3000/api/streamline/voice-event` |
| `HORIZON_WEBHOOK_SECRET` | Shared authentication secret | — |
| `HORIZON_WEBHOOK_TIMEOUT` | Request timeout (ms) | `5000` |
| `HORIZON_WEBHOOK_RETRIES` | Max retry attempts | `2` |

---

## LiveKit Webhooks

LiveKit can send server-side webhook notifications for room events (participant joined/left, recording started/stopped). These are received via the Horizon room hooks system.

**Endpoint:** `/api/rooms/:roomId/hooks`

**Events:**
- Room created / deleted
- Participant joined / left
- Track published / unpublished
- Egress started / completed / failed

These events can trigger automated actions in the Horizon AI system or be used for analytics and monitoring.

---

## Implementing Custom Webhooks

To add a new webhook integration:

1. **Create a route handler** in `streamline-server/routes/` for inbound webhooks
2. **Register the route** in `streamline-server/index.ts` — place _before_ JSON parser if raw body is needed
3. **Verify signatures** — Always validate webhook signatures for security
4. **Handle idempotently** — Webhook events may be delivered more than once
5. **Return quickly** — Process asynchronously if the handler involves heavy work
6. **Log events** — Use structured logging with request IDs for debugging

For outbound webhooks:
1. **Define the event** and payload format
2. **Add configuration** via environment variables for the target URL and secret
3. **Implement retry logic** for transient failures
4. **Encrypt sensitive data** in payloads if needed
