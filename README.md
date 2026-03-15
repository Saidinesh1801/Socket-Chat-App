# Socket Chat App

<<<<<<< HEAD
Real-time chat application built with Node.js, Socket.IO, and MongoDB.

![CI](https://github.com/saidinesh1801/socket-chat-app/actions/workflows/ci.yml/badge.svg)

## Features

- 💬 Real-time messaging with Socket.IO
- 🔐 User authentication (signup/login with JWT)
- 🔑 Password reset via email OTP
- 🏠 Multiple chat rooms with optional passwords
- 🤝 Private DM rooms (click a user to start DM)
- ✏️ Message editing and deletion
- 😄 Emoji reactions on messages
- 💬 Reply to messages (threaded context)
- 📎 File sharing (images, audio, video, documents up to 5MB)
- 🖼️ Image compression (via sharp)
- 🎙️ Voice messages (browser recording)
- ⌨️ Typing indicators
- 🟢 Online users list
- 🔍 Message search
- 🔗 Link previews (Open Graph)
- ✅ Read receipts (delivered/seen)
- 📜 Infinite scroll message pagination
- 🎨 4 themes (Light, Dark, Nord, Dracula)
- 📱 PWA support (installable, offline-capable)
- 🔔 Desktop notifications
- 📂 Drag & drop file upload
- ✨ Markdown-lite rendering (bold, italic, code, links)
- 🚦 Rate limiting (1 msg/sec)
- 🔒 HTTPS support (optional SSL certs)
- 📡 Redis adapter for horizontal scaling
- 🐳 Docker & Docker Compose support
- 🚀 CI/CD with GitHub Actions

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js, Express 5, Socket.IO, MongoDB/Mongoose |
| **Frontend** | Vanilla JS, CSS custom properties |
| **Auth** | JWT, bcrypt |
| **Security** | Helmet, CORS, CSP, rate limiting, SSRF protection |
| **DevOps** | Docker, GitHub Actions, Railway, Render |

## Quick Start

```bash
git clone https://github.com/saidinesh1801/socket-chat-app.git
cd socket-chat-app
cp .env.example .env   # fill in your values
npm install
npm start
```

The app runs at `http://localhost:3000` by default.

## Docker

```bash
docker compose up -d
```

## Development

```bash
npm run dev     # Node.js watch mode
npm test        # Run tests
```

## Project Structure

```
├── config/          # Database configuration
├── middleware/       # Auth middleware (JWT for HTTP & WebSocket)
├── models/          # Mongoose schemas (User, Message, Room)
├── public/          # Frontend (HTML, CSS, JS modules)
│   ├── css/
│   └── js/          # utils, auth, rooms, chat modules
├── routes/          # Express API routes
├── socket/          # Socket.IO event handlers
├── tests/           # Jest test suites
├── uploads/         # User uploaded files (gitignored)
└── utils/           # Email utilities
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/signup` | No | Create account |
| POST | `/api/login` | No | Login |
| POST | `/api/forgot-password` | No | Request OTP |
| POST | `/api/verify-otp` | No | Reset password |
| GET | `/api/rooms` | No | List rooms |
| POST | `/upload` | Yes | Upload file |
| GET | `/api/link-preview` | Yes | Fetch URL preview |
| GET | `/api/health` | No | Health check |

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

## Deployment

### Railway

A `railway.json` config is included. Connect your GitHub repo in the [Railway dashboard](https://railway.app) and it will auto-deploy on push.

### Render

A `render.yaml` blueprint is included. Create a new **Blueprint Instance** in [Render](https://render.com) and point it to this repo.

> For both platforms, set the environment variables listed above in the service settings.

## License

[ISC](https://opensource.org/licenses/ISC)
=======
A real-time, feature-rich chat application built with Node.js, Express, and Socket.IO. This project provides a modern and responsive chat experience, allowing users to communicate instantly in public or private rooms.

## Features

*   **Real-Time Messaging**: Instant message delivery and status updates powered by Socket.IO.
*   **Chat Rooms**: Users can create or join rooms to chat with groups of people.
*   **Online User Presence**: See who's online in the current chat room with a dynamic user list.
*   **File Sharing & Previews**: Share images and files with automatic in-app previews before sending.
*   **Image Lightbox**: Click on shared images to view them in a full-screen overlay.
*   **Dark Mode**: A sleek, modern UI with a toggle for light and dark themes.
*   **Secure & Reliable**: Implemented with security best practices, including XSS protection and rate limiting.

## Tech Stack

*   **Backend**: Node.js, Express, Socket.IO
*   **Database**: MongoDB (with Mongoose)
*   **Real-Time Engine**: Socket.IO with Redis Adapter for scalability
*   **Security**: Helmet, Express Rate Limit, JWT for authentication
*   **File Handling**: Multer for file uploads

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [MongoDB](https://www.mongodb.com/try/download/community) installed and running
*   [Redis](https://redis.io/docs/getting-started/installation/) installed and running (for multi-instance support)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/socket-chat-app.git
    cd socket-chat-app
    ```

2.  **Install NPM packages:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables. Update them to match your local configuration.

    ```env
    MONGODB_URI=mongodb://127.0.0.1:27017/chatApp
    PORT=3000
    JWT_SECRET=your_super_secret_jwt_key
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_email_password
    ```

### Running the Application

Once the installation is complete, you can run the application in development mode with hot-reloading:

```bash
npm run dev
```

Or, to run the standard server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Available Scripts

*   `npm start`: Starts the server in production mode.
*   `npm run dev`: Starts the server in development mode with file watching.
*   `npm test`: Runs the test suite.
*   `npm run test:coverage`: Runs tests and generates a coverage report.
*   `npm run docker:up`: Starts the required services (e.g., MongoDB, Redis) using Docker Compose.
*   `npm run docker:down`: Stops the services started with Docker Compose.
>>>>>>> ce82ec82ce65416b3e1781a8936802d410dcdb12
