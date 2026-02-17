# Trackzoon Software Requirements Specification (SRS)

Document version: 1.0  
Date: 2026-02-16  
Project: Trackzoon

## 1. Introduction
### 1.1 Purpose
This SRS defines functional and non-functional requirements for Trackzoon, a price-tracking platform with Telegram bot, web dashboard, backend APIs, and browser extension integration.

### 1.2 Scope
The system tracks Amazon product prices, evaluates deal quality, and notifies users based on configured criteria. It supports analytics, exports, admin operations, and optional AI-assisted decision logic.

### 1.3 Definitions
- Subscription: user-specific tracking configuration for a product.
- Target price alert: trigger when price crosses a user-set threshold.
- Percentage alert: trigger when price drops by configured percent from baseline.
- Smart score: computed deal quality score (0-100).
- Digest window: time interval where alerts are bundled before send.

## 2. System Overview
### 2.1 Major Components
- Telegram bot service (Telegraf command/action flows).
- Backend API service (Express routes/controllers/services).
- Scheduler and queue workers (node-cron + BullMQ).
- Data stores:
  - MongoDB (primary persistence)
  - Redis (queue/cache/locks, optional but recommended)
- Browser extension (Chrome/Safari conversion path) + extension API routes.
- Optional AI service layer (Groq-based integrations).

### 2.2 Runtime Modes
- Combined mode: bot + web server + internal workers in one process.
- Worker mode: dedicated worker process supported (`src/worker.js`).
- Leader lock: Redis lock prevents duplicate bot polling/scheduler workloads.

## 3. External Interface Requirements

### 3.1 Telegram Interface
The system shall support command-based and callback-based interactions.

Core commands (minimum):
- `/start`, `/help`, `/add`, `/add_percentage`, `/list`, `/removeone`, `/updateprice`, `/settings`, `/deals`, `/report`, `/digest`, `/insights`, `/search`, `/chart`, `/ask`, `/health`, `/export`, `/trending`

State-driven inputs shall support:
- URL + price input parsing
- threshold/percentage updates
- quiet hours/min discount/drop probability threshold updates

### 3.2 REST API Interface
Public/protected API namespaces shall include:
- Dashboard/Auth/User: `/api/login`, `/api/user/me`, `/api/stats`, `/api/deals`, `/api/search`, `/api/history/:asin`, `/api/products*`
- Analytics: `/api/analytics/*`
- Export: `/api/export/pdf`, `/api/export/rss`
- System: `/api/system/health`, `/api/system/db-stats`, `/api/system/queue`, `/api/system/metrics`
- Admin: `/api/admin/stats`, `/api/admin/check-prices`, `/api/admin/scrape-all`, `/api/admin/broadcast`
- Extension: `/api/v1/extension/sync`, `/api/v1/extension/status`

### 3.3 Browser Extension Interface
The extension shall:
- Scrape product data from supported Amazon product pages.
- Send `syncProduct` and `checkStatus` requests via background worker.
- Use `x-api-key` header for backend authentication.
- Support auto-sync cooldown and manual "Track" action.

## 4. Functional Requirements

### 4.1 User and Access Management
- FR-001: System shall create user records on first Telegram interaction.
- FR-002: Dashboard login shall issue JWT token valid for 24 hours.
- FR-003: Protected dashboard/admin routes shall require valid bearer token.
- FR-004: Extension routes shall require valid `EXTENSION_API_KEY`.

### 4.2 Product Tracking Lifecycle
- FR-005: System shall resolve and validate Amazon URL to ASIN before tracking.
- FR-006: System shall prevent duplicate subscription for same user-product pair.
- FR-007: System shall support alert types `drop` and `percentage`.
- FR-008: Removing final subscription from a product may remove orphaned product record.
- FR-009: System shall support snoozing subscription alerts until a timestamp.

### 4.3 Price Collection and Scheduling
- FR-010: Scheduler shall run periodic price checks (cron hourly).
- FR-011: Scheduler shall run daily report job (08:00 server time).
- FR-012: Scheduler shall flush alert digests every 5 minutes.
- FR-013: Due-product selection shall use `nextCheck <= now` unless force mode.
- FR-014: Price check batch shall be capped (current cap: 100 per run).
- FR-015: Queue add failure shall trigger in-memory fallback processing.

### 4.4 Scraping and Availability Handling
- FR-016: Scraper shall apply multi-strategy availability and price extraction.
- FR-017: Scraper shall detect captcha/blocking and optionally fallback to Puppeteer.
- FR-018: Circuit breaker shall trip after repeated blocking failures and cooldown.
- FR-019: Out-of-stock and no-buybox states shall be persisted and rescheduled.
- FR-020: AI availability verification shall be optional and confidence/budget-gated.

### 4.5 Pricing Intelligence and Data Updates
- FR-021: On price change, system shall append history and update last change metadata.
- FR-022: System shall maintain volatility score and check interval.
- FR-023: System shall compute smart score and deal label.
- FR-024: System shall detect and mark potential anomalies.
- FR-025: System shall support AI analysis/prediction updates under configured rules.

### 4.6 Alerting and Notification Rules
- FR-026: System shall send alerts only when decision criteria pass.
- FR-027: Minimum alert cooldown per subscription shall be enforced (3 hours).
- FR-028: Anomaly suppression window shall prevent immediate noisy alerts (6 hours).
- FR-029: Quiet mode and notification toggles shall suppress alerts when enabled.
- FR-030: `minDiscount` rule shall apply when no explicit threshold is set.
- FR-031: Percentage alerts shall use baseline-price target formula.
- FR-032: System shall send back-in-stock alerts when threshold conditions are met.
- FR-033: System shall support digest bundling with configurable window and max items.
- FR-034: System shall support drop-probability alerts with user threshold and cooldown.
- FR-035: Optional webhook notification shall be sent for price-alert events.

### 4.7 Dashboard and Analytics
- FR-036: Dashboard shall provide stats, deals list, search, recent activity, and top tracked.
- FR-037: Dashboard shall expose product history, volatility, forecast, best day, and stock history.
- FR-038: Dashboard shall provide best-drops, trend overview, and top categories analytics.
- FR-039: Dashboard shall support add/preview product and product metadata updates (tags/archive/target).
- FR-040: Dashboard shall support import and export operations.

### 4.8 Admin Operations
- FR-041: Admin shall view system-level counts and runtime info.
- FR-042: Admin shall trigger check-prices/scrape-all actions.
- FR-043: Admin shall broadcast message to users with notifications enabled.

### 4.9 Export and Reporting
- FR-044: System shall export product data as CSV.
- FR-045: System shall export PDF report.
- FR-046: System shall provide RSS feed of latest items.
- FR-047: Bot daily report command shall summarize tracked portfolio.

### 4.10 Extension Sync
- FR-048: Sync endpoint shall support `created`, `updated`, and `new_product` outcomes.
- FR-049: Extension status endpoint shall return tracked/not-tracked state by ASIN.
- FR-050: Extension sync shall capture price, stock, merchant/prime/coupon/rating when available.

## 5. Data Requirements

### 5.1 Core Entities
- User
  - key: `telegramId` (unique)
  - settings: notifications, dailyReport, quietMode, minDiscount, alertSensitivity, autoTarget, watchAgain, dropProbabilityAlerts, aiAdviceThresholds
- Product
  - key: `asin` (unique)
  - fields: `url`, `name`, `currentPrice`, stock flags, pricing history, stats, volatility, smart score, deal label, AI fields, merchant metadata
- Subscription
  - unique compound: `(user, product)`
  - fields: `targetPrice`, `alertType`, `percentageThreshold`, `baselinePrice`, `snoozeUntil`, alert timestamps
- PricePoint
  - time-series point for product price snapshots
- SystemMetric
  - typed metric snapshots (`scraper`, `database`, `system`)

### 5.2 Retention/Trim Rules
- Product `priceHistory` trimmed by count and age:
  - max entries: 100
  - max age: 90 days
- Product `stockHistory` trimmed to last 100 entries.

## 6. Non-Functional Requirements

### 6.1 Performance
- NFR-001: System shall support queued background price checks with controlled concurrency.
- NFR-002: Worker concurrency shall remain configurable and safe for low-resource hosting.
- NFR-003: API responses for common dashboard endpoints should remain interactive for normal dataset sizes.

### 6.2 Availability and Reliability
- NFR-004: System shall degrade gracefully if Redis queue/cache is unavailable.
- NFR-005: System shall degrade gracefully if AI provider is unavailable or budget-limited.
- NFR-006: Graceful shutdown shall stop scheduler/worker/bot resources cleanly.

### 6.3 Security
- NFR-007: Admin/dashboard routes shall require JWT auth.
- NFR-008: Extension sync routes shall require API key auth.
- NFR-009: Sensitive secrets shall be environment-configured (no hardcoded production secrets).
- NFR-010: CSP/security headers shall be applied via middleware (helmet/cors as configured).

### 6.4 Observability
- NFR-011: System shall emit structured logs to console and rotating files.
- NFR-012: Optional Sentry integration shall capture runtime exceptions and warnings.
- NFR-013: Health/metrics endpoints shall provide operational introspection.

### 6.5 Maintainability and Testability
- NFR-014: Service-layer architecture shall separate route/controller/business logic.
- NFR-015: Core pricing/scraper behavior shall remain covered by automated tests.

## 7. Configuration Requirements

### 7.1 Required in Production
- `BOT_TOKEN`
- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- `EXTENSION_API_KEY`

### 7.2 Strongly Recommended
- `REDIS_URL`
- `SENTRY_DSN`
- `GROQ_API_KEY` (for AI features)
- `NODE_ENV=production`

### 7.3 Optional Behavior Controls
- `PORT`, `CORS_ORIGIN`, `PUBLIC_BASE_URL`
- `PROCESS_TYPE`, `BOT_LOCK_KEY`, `BOT_LOCK_TTL_MS`
- `ALERT_AUTO_SNOOZE_HOURS`
- `ALERT_DIGEST_WINDOW_MINUTES`, `ALERT_DIGEST_MAX_ITEMS`
- `AI_VERIFY_MODE`, `AI_VERIFY_MIN_CONFIDENCE`
- `AI_DAILY_TOKEN_LIMIT`, `AI_DAILY_REQUEST_LIMIT`
- `AI_AVAILABILITY_SCHEDULE_COOLDOWN_SECONDS`
- `APP_URL`/`RENDER_EXTERNAL_URL` for keep-alive
- `PUPPETEER_EXECUTABLE_PATH`

## 8. Operational Requirements
- OR-001: Deployment shall support Node.js 20 runtime.
- OR-002: Process shall expose HTTP service on configured `PORT`.
- OR-003: Scheduler and bot leadership shall avoid duplicate processing across instances.
- OR-004: Queue workers shall connect to same Redis and MongoDB as API/bot services.

## 9. Validation and Acceptance
- Validate Telegram flows for add/update/remove/list/report/settings.
- Validate scheduler runs and queue fallback behavior under Redis outage.
- Validate alert suppression (cooldown/quiet mode/snooze).
- Validate extension sync auth and status workflows.
- Validate dashboard protected routes and admin-only operations.
- Validate exports (CSV/PDF/RSS).

## 10. Known Gaps and Clarifications
- README statements and implementation are partially inconsistent (for example, cadence and marketplace breadth); implementation behavior in code is the source of truth for this SRS.
- Some legacy `trackedBy` references remain for backward compatibility while primary ownership has moved to `Subscription`.
- Production-hardening items (secret defaults, strict CORS/CSP, admin auth model) should be explicitly reviewed before public deployment.
