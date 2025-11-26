# Walkthrough - Admin Dashboard

I have added a secure Admin Dashboard to manage the Trackzoon system.

## How to Access
1.  Open the dashboard.
2.  Click the **Login** icon (top right).
3.  Enter your **Telegram ID**.
    - If you are an admin, you will be redirected to the Admin Panel.
    - If not, you will see a "Coming Soon" message for the user dashboard.

## Admin Features
### 1. System Stats 📊
- **Total Users**: Real-time count of active users.
- **Total Products**: Number of tracked items.
- **Active Alerts**: How many users are waiting for price drops.
- **Uptime**: Server running time.

### 2. Force Scrape ⚡
- **Action**: Click "Force Scrape All Prices".
- **Effect**: Immediately triggers a price check for ALL products in the database. Use this if you suspect prices are outdated.

### 3. Broadcast Message 📢
- **Action**: Type a message and click "Send Broadcast".
- **Effect**: Sends a Telegram message to **ALL** users who have notifications enabled. Great for announcements or downtime alerts.

## Verification
- **Login**: Try logging in with a non-admin ID (should fail/alert) and an admin ID (should succeed).
- **Stats**: Verify numbers match your database.
- **Actions**: Test the broadcast feature with a small test message.
