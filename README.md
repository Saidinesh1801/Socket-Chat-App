# Socket Chat App

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
