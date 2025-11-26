# Dashboard Refactoring Roadmap

- [x] **1. Plan Unified Structure**
    - [x] Design the layout for Public vs Logged In vs Admin states.
    - [x] Create `implementation_plan.md`.
- [x] **2. Backend Updates**
    - [x] Create/Update `/api/user/me` to return user profile and role (`isAdmin`).
- [x] **3. Frontend Refactoring (index.html)**
    - [x] Remove `admin.html`.
    - [x] Add "Admin Section" to `index.html` (hidden by default).
    - [x] Update Navigation (Login -> Profile/Logout).
    - [x] Implement State Management (Public -> User -> Admin).
- [x] **4. Implement Role-Based Views**
    - [x] **Public**: Search, Top Deals, Login.
    - [x] **User**: + My Products, Add Product, Settings.
    - [x] **Admin**: + System Stats, Force Scrape, Broadcast.
- [x] **5. Verify & Polish**
    - [x] Test all 3 states.
    - [x] Ensure consistent design (Tailwind).
