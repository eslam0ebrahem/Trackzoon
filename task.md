# Dashboard Enhancements Roadmap

- [ ] **1. Analyze Existing Dashboard**
    - [ ] Review `src/server.js` and any template files.
    - [ ] Understand current auth mechanism (if any).
- [ ] **2. Implement Role-Based Access**
    - [ ] Add `isAdmin` flag to `User` model.
    - [ ] Implement simple login or token-based auth for dashboard access.
- [ ] **3. Create Admin Dashboard**
    - [ ] Create a new view/route for admins.
    - [ ] Add "System Health" widget (CPU, Memory, DB status).
    - [ ] Add "User Management" widget (List users, total count).
    - [ ] Add "Global Stats" widget (Total products, total alerts sent).
- [ ] **4. Enhance User Dashboard**
    - [ ] Ensure users only see their own data.
    - [ ] Add "My Products" list with edit/delete actions.
- [ ] **5. Add Admin Controllers**
    - [ ] "Force Scrape All" button.
    - [ ] "Broadcast Message" form.
