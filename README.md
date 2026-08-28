# Trackzoon — Real-Time Tracking System

**Node.js · Socket.IO · MongoDB · React**

A real-time tracking system with a live dashboard — track vehicles, packages, or any entities with WebSocket updates and a clean React frontend.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Language | JavaScript |
| Runtime | Node.js |
| Real-Time | Socket.IO |
| Database | MongoDB |
| Frontend | React |
| Auth | JWT |
| Deployment | Vercel, Railway, Render |

---

## Features

- **Real-Time Tracking** — Live WebSocket updates via Socket.IO
- **React Dashboard** — Interactive frontend to view tracked entities
- **JWT Authentication** — Secure access to the dashboard
- **Multi-Platform** — Deployable on Vercel, Railway, or Render
- **Docker Support** — Containerized deployment ready

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in: MONGODB_URI, NEXTAUTH_SECRET, BOT_TOKEN (optional)

# Run development server
npm run dev
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tracks` | List all tracked entities |
| POST | `/api/tracks` | Create a new track |
| GET | `/api/tracks/:id` | Get track by ID |
| PUT | `/api/tracks/:id` | Update track position |
| DELETE | `/api/tracks/:id` | Remove a track |

Socket.IO events: `track:update`, `track:create`, `track:delete`

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | NextAuth signing secret |
| `NEXTAUTH_URL` | App URL (e.g. http://localhost:3000) |
| `BOT_TOKEN` | Telegram bot token (optional) |
| `ADMIN_USERNAME` | Dashboard admin username |
| `ADMIN_PASSWORD` | Dashboard admin password |

---

## License

MIT
