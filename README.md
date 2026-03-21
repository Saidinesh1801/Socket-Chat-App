# Socket Chat App

Real-time chat application built with Node.js, TypeScript, Socket.IO, and MongoDB.

![CI](https://github.com/saidinesh1801/socket-chat-app/actions/workflows/ci.yml/badge.svg)

## Features

### Core Chat
- 💬 Real-time messaging with Socket.IO
- 🏠 Multiple chat rooms with optional passwords
- 🤝 Private DM rooms (click a user to start DM)
- ✏️ Message editing and deletion
- 😄 Emoji reactions on messages
- 💬 Reply to messages (threaded context)
- 🔍 Message search
- 📜 Infinite scroll message pagination

### User Features
- 🔐 User authentication (signup/login with JWT)
- 🔑 Password reset via email OTP
- 🖼️ Custom avatar (upload image, custom URL, or choose from presets)
- 📱 Responsive design (desktop, tablet, mobile)
- 🔔 Desktop notifications
- 🟢 Online users list

### File Sharing
- 📎 File sharing (images, audio, video, documents up to 5MB)
- 🖼️ Image compression (via sharp)
- 🎙️ Voice messages (browser recording)
- 📂 Drag & drop file upload
- 🔗 Link previews (Open Graph)

### UI/UX
- ⌨️ Typing indicators
- ✅ Read receipts (delivered/seen)
- 🎨 4 themes (Light, Dark, Nord, Dracula)
- 🎨 Custom wallpapers
- 📱 PWA support (installable, offline-capable)
- ✨ Markdown-lite rendering (bold, italic, code, links)

### Security & Performance
- 🚦 Rate limiting (1 msg/sec)
- 🔒 HTTPS support (optional SSL certs)
- 📡 Redis adapter for horizontal scaling
- 🔒 Helmet, CORS, CSP, SSRF protection

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js, TypeScript, Express 5, Socket.IO, MongoDB/Mongoose |
| **Frontend** | Vanilla JS (ES6 modules), CSS custom properties |
| **Auth** | JWT, bcrypt |
| **Security** | Helmet, CORS, CSP, rate limiting, SSRF protection |
| **Testing** | Jest, Supertest |
| **DevOps** | Docker, GitHub Actions, Railway, Render |

## Quick Start

```bash
git clone https://github.com/saidinesh1801/socket-chat-app.git
cd socket-chat-app
cp .env.example .env   # fill in your values
npm install
npm run build         # Compile TypeScript
npm start             # Run production build
```

The app runs at `http://localhost:3000` by default.

## Development

```bash
npm install
npm run dev           # Run with ts-node (development)
npm run lint          # TypeScript type checking
npm test              # Run tests
npm run test:coverage # Run tests with coverage
npm run build         # Build for production
```

## Docker

```bash
docker compose up -d
```

## Project Structure

```
├── config/           # Database & Swagger configuration
├── middleware/       # Auth middleware (JWT for HTTP & WebSocket)
├── models/           # Mongoose schemas (User, Message, Room)
├── public/           # Frontend (HTML, CSS, JS modules)
│   ├── css/         # Stylesheets
│   └── js/          # JavaScript modules
│       ├── shared.js    # Shared utilities (auth, avatar, display)
│       ├── utils.js     # UI utilities (modals, upload, presets)
│       ├── auth.js      # Authentication UI
│       ├── chat.js      # Chat UI & socket events
│       └── rooms.js     # Room management UI
├── routes/           # Express API routes
├── socket/           # Socket.IO event handlers
├── tests/            # Jest test suites
├── types/            # TypeScript type definitions
├── utils/            # Email, logger, sanitization, presets
└── uploads/         # User uploaded files
```

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/signup` | No | Create account |
| POST | `/api/v1/login` | No | Login |
| POST | `/api/v1/forgot-password` | No | Request OTP |
| POST | `/api/v1/verify-otp` | No | Reset password |

### Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/profile` | Yes | Get current user profile |
| PUT | `/api/v1/profile/status` | Yes | Update status message |
| POST | `/api/v1/profile/avatar` | Yes | Upload avatar image |
| POST | `/api/v1/profile/avatar-url` | Yes | Set avatar from URL |
| POST | `/api/v1/profile/avatar/preset` | Yes | Set preset avatar |
| DELETE | `/api/v1/profile/avatar` | Yes | Remove avatar |
| GET | `/api/v1/profile/presets` | No | Get preset avatars |
| GET | `/api/v1/profile/avatar-categories` | No | Get avatar categories |

### Rooms
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/rooms` | No | List rooms |
| POST | `/api/v1/rooms` | Yes | Create room |
| PUT | `/api/v1/rooms/:id` | Yes | Update room |
| DELETE | `/api/v1/rooms/:id` | Yes | Delete room |

### Utilities
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/upload` | Yes | Upload file |
| GET | `/api/v1/link-preview` | Yes | Fetch URL preview |
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/health/ready` | No | Readiness check |

## Avatar System

The app supports three ways to set your avatar:

1. **Upload Image**: Upload a photo from your device
2. **Custom URL**: Paste any image URL
3. **Preset Avatars**: Choose from curated categories:
   - Cool Styles
   - Vibrant Colors
   - Pastel
   - Robots
   - Fun

Avatar URLs are saved to MongoDB and loaded on login.

## Environment Variables

See [`.env.example`](.env.example) for a complete template.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `EMAIL_USER` | Yes* | Gmail address for sending password reset emails |
| `EMAIL_PASS` | Yes* | Gmail app password (not your account password) |
| `PORT` | No | Server port (default: `3000`) |
| `CLIENT_URL` | No | Allowed CORS origin (default: `http://localhost:3000`) |
| `REDIS_URL` | No | Redis connection URL for multi-instance scaling |
| `SSL_KEY` | No | Path to SSL private key for HTTPS |
| `SSL_CERT` | No | Path to SSL certificate for HTTPS |

\* Required only if using the password reset feature.

## Testing

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

Tests cover:
- Authentication (signup, login, password reset)
- Avatar API (upload, URL, presets)
- Profile management
- Room management
- Security (XSS sanitization, SSRF protection)

## Deployment

### Railway

A `railway.json` config is included. Connect your GitHub repo in the [Railway dashboard](https://railway.app) and it will auto-deploy on push.

### Render

A `render.yaml` blueprint is included. Create a new **Blueprint Instance** in [Render](https://render.com) and point it to this repo.

> For both platforms, set the environment variables listed above in the service settings.

## License

[ISC](https://opensource.org/licenses/ISC)
