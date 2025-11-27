# Trackzoon Project Audit Report

**Date:** 2025-11-27
**Auditor:** Senior Principal Software Engineer & System Architect
**Status:** Phase 1 Complete

## Executive Summary
The Trackzoon project is a functional prototype with a solid core concept (Amazon price tracking). However, it currently exhibits significant "technical debt" that prevents it from being a market-ready release candidate. Critical security vulnerabilities, performance bottlenecks, and architectural scalability issues must be addressed immediately.

## 1. Architecture Review
**Status: 🔴 Critical**

*   **Monolithic Services:** `PriceTrackerService` is a "God Class" (31KB+) handling scraping, business logic, database operations, and notifications. This violates the Single Responsibility Principle (SRP) and makes maintenance a nightmare.
*   **Logic Leakage:** Business logic leaks into `dashboardController.js` (e.g., instantiating services, hardcoded user IDs). Controllers should only handle HTTP requests/responses.
*   **Tight Coupling:** Services directly import Models and other Services, making unit testing impossible without mocking the entire database.
*   **No Dependency Injection:** Dependencies are hardcoded, reducing flexibility.

## 2. Logic & Performance Gaps
**Status: 🟠 High Risk**

*   **Synchronous I/O (Performance Killer):** The `logger.js` utility uses `fs.appendFileSync`. In a Node.js event loop, this blocks the entire server for every single log entry. Under load, this will cause massive latency spikes.
*   **Database Scalability:** The `Product` model stores `priceHistory` as an array within the document. MongoDB has a 16MB document limit. As history grows, performance will degrade, and eventually, updates will fail.
*   **Race Conditions:** `PriceTrackerService.checkPrice` calculates logic based on a fetched object and then updates the DB. If two checks happen simultaneously, data will be overwritten/lost.
*   **Magic Numbers:** Hardcoded values like `999999` (Dashboard User ID) and `30` (check interval) are scattered throughout the code.

## 3. Security Risks
**Status: 🔴 CRITICAL**

*   **Zero Authentication:** The `dashboardRoutes.js` file exposes sensitive endpoints (e.g., `/api/admin/check-prices`, `/api/products`) without **ANY** authentication middleware. Anyone with the URL can trigger scrapes, modify products, or dump the database.
*   **Weak Input Validation:** API endpoints accept data without strict schema validation (e.g., `req.body.threshold` is not validated).
*   **Secrets Management:** While `.env` is used, `process.env` is accessed directly everywhere, making it hard to track dependency on environment variables.

## 4. Code Quality & "Code Smells"
**Status: 🟡 Medium Risk**

*   **DRY Violations:** Scraping fallback logic and error handling patterns are repeated.
*   **Hardcoded Selectors:** `getPrice.js` relies on fragile CSS selectors. While the logic is robust, the selectors should be externalized or managed more centrally.
*   **Error Handling:** Errors are often caught and logged without proper propagation or structured response, leading to "silent failures" or vague 500 errors.

## Recommendations (Phase 2 Preview)

1.  **Secure the API:** Implement JWT Authentication immediately.
2.  **Refactor Database:** Move `priceHistory` to a separate `PricePoint` collection (Time-Series Data).
3.  **Fix Logging:** Replace `fs.appendFileSync` with a high-performance async logger (Winston/Pino).
4.  **Modularize Architecture:** Break `PriceTrackerService` into `ScraperService`, `AlertService`, and `ProductService`.
5.  **Implement Validation:** Add Joi/Zod middleware for all API inputs.
