# Walkthrough - Unified Dashboard

I have refactored the dashboard into a single, cohesive interface (`index.html`) that adapts to your role.

## Features by Role

### 🌍 Public User (No Login)
- **Top Global Deals**: View the hottest deals across the platform.
- **Search**: Find products by name.
- **Login**: Access your personal dashboard via Telegram ID.

### 👤 Logged In User
- **My Products Tab**: Switch between "Top Deals" and "My Products" to see your tracked items.
- **Add Product**: Track new items directly from the dashboard.
- **Settings**: Manage your preferences.

### 🛡️ Admin
- **Admin Panel**: A special section appears at the bottom.
- **System Stats**: Monitor users, products, and uptime.
- **Actions**: Force scrape all prices or broadcast messages to all users.

## How to Verify
1.  **Public**: Open the site without logging in. You should see "Top Global Deals" but no "My Products" tab.
2.  **User**: Click Login, enter a User ID. You should see the "My Products" tab appear.
3.  **Admin**: Click Login, enter an Admin ID. You should see the "Admin Panel" at the bottom with extra controls.
