# Implementation Plan - Unified Dashboard Architecture

I will refactor the dashboard to provide a seamless experience for Public, User, and Admin roles within a single interface (`index.html`).

## User Review Required
> [!IMPORTANT]
> I will remove `admin.html` and merge its functionality into `index.html`.
> I will add a new endpoint `/api/user/me` to fetch the current user's profile and role.

## Proposed Changes

### Backend
#### [NEW] [userRoutes.js](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/routes/userRoutes.js)
- `GET /me`: Returns `{ telegramId, username, isAdmin, ... }` based on the `x-telegram-id` header.

### Frontend
#### [MODIFY] [index.html](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/public/index.html)
- **Navigation**:
    - Default: "Login" button.
    - Logged In: "Profile" (User) or "Admin Panel" (Admin) dropdown.
- **Sections**:
    - `div#public-view`: Top Global Deals (Always visible or default).
    - `div#user-view`: My Products, Add Product (Visible if logged in).
    - `div#admin-view`: System Stats, Force Scrape (Visible if `isAdmin`).
- **Logic**:
    - On load, check `localStorage.telegramId`.
    - If present, call `/api/user/me`.
    - Update UI state based on response.

#### [DELETE] [admin.html](file:///Users/IslamIbrahim/Work/Projects/Trackzoon/src/public/admin.html)
- Redundant after merge.

## Verification Plan
1.  **Public State**: Open incognito, see "Top Deals" and "Login".
2.  **User State**: Login with normal ID, see "My Products" and "Add Product".
3.  **Admin State**: Login with Admin ID, see "Admin Panel" with stats and controls.
