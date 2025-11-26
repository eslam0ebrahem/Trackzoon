# Implementation Plan - Admin Dashboard & Role-Based Access

I will enhance the web dashboard to support an Admin view with advanced controllers and system stats.

## User Review Required
> [!IMPORTANT]
> I will add an `isAdmin` field to the User schema.
> For simplicity, I will assume the dashboard is accessed via a URL parameter or a simple login page (to be implemented) that sets a local storage flag, or I'll just expose the admin routes and rely on the user to secure the endpoint (e.g. via basic auth or just obscurity for this MVP).
> **Decision**: I'll implement a simple "Login" page that asks for a Telegram ID. If that ID matches an admin (flag in DB), they get the Admin Dashboard.

## Proposed Changes

### Database
#### [MODIFY] [User.js](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/models/User.js)
- Add `isAdmin: { type: Boolean, default: false }` to schema.

### Backend Routes
#### [NEW] [adminRoutes.js](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/routes/adminRoutes.js)
- `GET /stats`: Returns system health, total users, total products.
- `POST /broadcast`: Sends a message to all users.
- `POST /scrape-all`: Triggers a manual scrape for all products.

#### [MODIFY] [server.js](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/server.js)
- Register `adminRoutes`.

### Frontend (Public)
#### [MODIFY] [index.html](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/public/index.html)
- Add a simple login form (Enter Telegram ID).
- Logic to fetch user role on login.
- Show "Admin Panel" button if admin.

#### [NEW] [admin.html](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/public/admin.html)
- Dashboard view for admins.
- Widgets: System Health, User Stats.
- Actions: Broadcast, Force Scrape.

## Verification Plan

### Manual Verification
1.  **Set Admin**: Manually update my user record in DB to `isAdmin: true`.
2.  **Login**: Use my Telegram ID on the dashboard.
3.  **Verify View**: Check if Admin Panel button appears.
4.  **Test Actions**:
    - Click "Force Scrape" and check logs.
    - Send a broadcast message and check Telegram.
