# Trackzoon Product Requirements Document (PRD)

Document version: 1.0  
Date: 2026-02-16  
Project: Trackzoon

## 1. Product Vision
Trackzoon is a deal-intelligence assistant for Amazon shoppers: users track items, receive high-signal alerts, and use analytics to decide when to buy.

## 2. Product Goals
- Make price tracking effortless.
- Deliver fewer but more meaningful alerts.
- Provide confidence-building analytics and advice.
- Support a unified experience across Telegram, dashboard, and browser extension.

## 3. Non-Goals
- Building an end-to-end e-commerce checkout flow.
- Supporting every marketplace equally in current phase.
- Building native iOS/Android apps in this release scope.

## 4. Target Users
- Casual deal hunters: track a handful of products and wait for a target price.
- Power users: track many products, tune sensitivity, monitor trends and reports.
- Admin/operator users: monitor system health and manage imports/broadcasts.

## 5. User Jobs To Be Done
- "Tell me when this item is actually worth buying."
- "Prevent me from missing price drops and restocks."
- "Summarize my portfolio so I can act quickly."
- "Let me track while browsing Amazon directly."

## 6. Experience Principles
- Fast onboarding: add a product in minimal steps.
- Signal over noise: alert quality is more important than alert quantity.
- Explainability: show trend, score, and context for each decision.
- Resilience: degraded modes must still provide value when subsystems fail.

## 7. Feature Scope and Priority

### 7.1 P0 Features
- Product tracking by Amazon URL/ASIN.
- Alert modes:
  - Absolute target price crossing.
  - Percentage-drop threshold from baseline.
- Telegram core commands (`/add`, `/list`, `/removeone`, `/updateprice`, `/deals`, `/settings`, `/report`).
- Scheduled checking and notification pipeline.
- User preference controls:
  - notifications on/off
  - quiet mode and quiet hours
  - min discount
  - alert sensitivity
  - snooze window behavior

### 7.2 P1 Features
- Dashboard: stats, deals feed, product history chart, analytics widgets.
- Export: CSV/PDF/RSS.
- Admin controls: health/stats, manual checks, broadcast.
- Extension integration: scrape and sync from Amazon pages with API-key auth.
- Alert digest bundling to reduce notification spam.

### 7.3 P2 Features
- AI-enhanced deal analysis and advice.
- AI availability verification fallback.
- Smart target suggestions and personalized advice thresholds.
- Trend forecast and drop-probability insights.

## 8. Functional Requirements

### 8.1 Onboarding and Tracking
- PRD-F-001: User can add product by URL and optional target.
- PRD-F-002: If already tracked, user is prompted to update instead of duplicate tracking.
- PRD-F-003: User can track via percentage-drop mode and update percentage later.
- PRD-F-004: User can remove a tracked product with confirmation.

Acceptance criteria:
- Add flow validates URL and ASIN extraction.
- Duplicate tracking does not create duplicate subscriptions.
- Percentage mode stores baseline + computed target.

### 8.2 Notification Quality
- PRD-F-005: Alerts must obey cooldown windows and user settings.
- PRD-F-006: Quiet mode suppresses alerts during configured hours.
- PRD-F-007: Alert digest groups multiple alerts in active window.
- PRD-F-008: Back-in-stock alert triggers when price is at/under target.

Acceptance criteria:
- Repeated alerts for same subscription are rate-limited.
- Quiet mode supports wrapped windows (e.g., 22:00-08:00).
- Digest sends grouped summary when bundling window closes.

### 8.3 Insights and Decision Support
- PRD-F-009: User can view smart insights for a product.
- PRD-F-010: User can request digest summary for tracked portfolio.
- PRD-F-011: Dashboard shows volatility, trend, best drops, top categories.
- PRD-F-012: Chart/history is available when sufficient data exists.

Acceptance criteria:
- Insights include score/context where data exists.
- Missing-data states are explicit and non-breaking.

### 8.4 Extension-Assisted Workflow
- PRD-F-013: Extension syncs page data to backend securely via API key.
- PRD-F-014: Extension distinguishes tracked vs non-tracked ASIN state.
- PRD-F-015: Extension can request create-on-sync when user confirms tracking.

Acceptance criteria:
- Invalid API key returns unauthorized and prevents sync.
- Sync endpoint supports update and create flows.

### 8.5 Admin and Operations
- PRD-F-016: Admin can authenticate and access protected endpoints.
- PRD-F-017: Admin can trigger manual price checks and send broadcast messages.
- PRD-F-018: System dashboard shows health, DB stats, and logs.

Acceptance criteria:
- Unauthorized users cannot access admin routes.
- Admin operations return structured success/failure summaries.

## 9. UX Flows
- Flow A (Telegram add): `/add` -> parse URL/target -> preview/add -> confirm tracking.
- Flow B (Deal alert): scheduled check -> decision filter -> send immediate alert or digest queue.
- Flow C (Dashboard analysis): login -> deals list -> select product -> history + analytics panels.
- Flow D (Extension): open product page -> scrape -> sync status check -> update or track CTA.

## 10. Success Metrics
- Activation: users who add at least one product after onboarding.
- Retention: users with active tracked products after 7/30 days.
- Alert effectiveness: share of alerts resulting in user click-through or follow-up action.
- Noise reduction: lower repeated-alert complaints / manual snooze frequency.
- Reliability: scheduled cycles completed and queue job success rate.

## 11. Release Plan
- Release 1: Core tracking, Telegram flows, baseline alerts.
- Release 2: Dashboard analytics + exports + admin controls.
- Release 3: Extension sync and status workflow.
- Release 4: AI quality features and smart targeting refinements.

## 12. Open Product Decisions
- Marketplace expansion strategy beyond current Amazon-focused behavior.
- User-facing explanation style for AI confidence and anomaly suppression.
- Long-term role model for admin/dashboard users vs Telegram users.
