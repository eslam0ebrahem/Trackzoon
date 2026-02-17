# Trackzoon Business Requirements Document (BRD)

Document version: 1.0  
Date: 2026-02-16  
Project: Trackzoon

## 1. Executive Summary
Trackzoon is a multi-channel price-tracking product that helps shoppers monitor Amazon listings, detect deal opportunities, and receive actionable alerts through Telegram, a web dashboard, and browser extension workflows.

The business goal is to reduce the effort and uncertainty of manual price checking while increasing successful purchase decisions at favorable prices.

## 2. Business Problem
Users currently face these issues:
- Manual monitoring is time-consuming and inconsistent.
- Users miss short-lived price drops and stock returns.
- Users lack historical and contextual data to judge if a current price is truly a deal.
- Users do not have a unified workflow across messaging, dashboard analytics, and on-page browser interaction.

## 3. Business Objectives
### 3.1 Primary Objectives
- Provide reliable near-real-time price monitoring for tracked products.
- Increase user confidence in purchase timing via analytics and AI-assisted signals.
- Create a sticky, repeatable workflow across Telegram + dashboard + extension.

### 3.2 Measurable Success Metrics
- Alert relevance rate: reduce low-value alerts through sensitivity and filtering rules.
- Engagement: increase weekly active tracked users and repeat command usage (`/list`, `/deals`, `/digest`).
- Tracking growth: increase number of active subscriptions per user.
- Time-to-awareness: reduce delay between meaningful price change and user notification.
- Operational reliability: keep scheduler, scraping, and queue workflows continuously available.

## 4. Stakeholders
- End users: shoppers tracking products and receiving alerts.
- Product owner: responsible for roadmap and prioritization.
- Engineering: backend, bot, dashboard, and extension maintainers.
- Operations: deployment, runtime health, incident handling.
- Admin users: dashboard admins for monitoring, imports, and broadcast operations.

## 5. Scope
### 5.1 In Scope
- Product tracking by URL/ASIN.
- Target-price and percentage-drop alerts.
- Smart alert filtering (sensitivity, quiet mode, min discount, cooldown).
- Price history, trend, volatility, and deal scoring.
- Telegram command and action workflows.
- Web dashboard (deals, history, analytics, system/admin views).
- Browser extension sync to backend APIs.
- Export features (CSV/PDF/RSS).
- AI-assisted analysis (availability checks, advice, forecast support).

### 5.2 Out of Scope (Current Phase)
- Native mobile app beyond web/PWA behavior.
- Checkout/purchase automation.
- Payment/subscription billing system.
- Multi-tenant enterprise account model.
- Full non-Amazon marketplace parity at production quality.

## 6. Business Requirements
- BR-001: The platform shall let users track products with user-specific alert targets.
- BR-002: The platform shall notify users when configured conditions are met (price drop, threshold crossed, back in stock).
- BR-003: The platform shall maintain historical pricing to support trend and confidence decisions.
- BR-004: The platform shall support user preferences for notification quality (quiet mode, sensitivity, min discount, snooze).
- BR-005: The platform shall provide administrators with health and operational visibility.
- BR-006: The platform shall support extension-assisted data ingestion from supported Amazon pages.
- BR-007: The platform shall provide data portability (CSV/PDF/RSS export).
- BR-008: The platform shall use AI selectively to improve decisions while controlling token/cost risk.
- BR-009: The platform shall operate in degraded mode when optional subsystems (Redis, AI) are unavailable.

## 7. Business Constraints
- Scraping reliability depends on target-site anti-bot behavior and markup changes.
- AI usage depends on provider quota and configured cost limits.
- Free-tier infrastructure constraints require controlled concurrency and queue-based processing.
- Security posture depends on correct environment configuration (secrets, API keys, JWT secret, admin password).

## 8. Assumptions
- Core usage is Amazon-focused, with strongest current behavior around Amazon.eg/EGP workflows.
- Users accept Telegram as a primary notification channel.
- Redis is available in most production deployments for queueing/caching, but system must tolerate absence.
- MongoDB remains the system of record.

## 9. Risks and Mitigations
- Risk: Excessive noisy alerts reduce trust.  
  Mitigation: sensitivity modes, cooldown windows, anomaly filters, digest bundling.
- Risk: Scraper blockage (captcha/rate limits).  
  Mitigation: circuit breaker, Puppeteer fallback, AI verification paths, scheduling cooldown.
- Risk: Cost spikes from AI calls.  
  Mitigation: daily token/request guardrails, global pause, confidence gating.
- Risk: Duplicate bot processing in multi-instance deployment.  
  Mitigation: distributed Redis lock for bot leadership.
- Risk: Operational blind spots.  
  Mitigation: system metrics, logs, Sentry integration, admin system dashboard.

## 10. Milestone View (Business)
- Phase 1: Reliable tracking and notifications baseline (Telegram + DB + scheduler).
- Phase 2: Dashboard analytics and admin controls.
- Phase 3: Extension sync and cross-channel workflows.
- Phase 4: AI-assisted quality improvements and smart targeting.
- Phase 5: Optimization, reliability hardening, and scale readiness.

## 11. Acceptance of BRD
This BRD is considered accepted when business stakeholders confirm:
- Scope boundaries are correct.
- Success metrics are suitable for decision-making.
- Priority requirements BR-001 to BR-009 align with near-term roadmap.
