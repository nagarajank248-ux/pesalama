# Pesuvoma - Real-Time Chat Application

A modern, real-time chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.io.

## Features
- Real-time messaging with Socket.io
- User Authentication (JWT)
- Modern UI with Dark Mode
- User Search
- Message History

## Tech Stack
- **Frontend:** React, Vite, Axios, Socket.io-client
- **Backend:** Node.js, Express, MongoDB, Mongoose, Socket.io
- **Database:** MongoDB (Local or Atlas)

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/nagarajank248-ux/pesalama.git
cd pesalama
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` folder:
```env
MONGO_URI=mongodb://127.0.0.1:27017/pesuvoma
JWT_SECRET=your_secret_key
PORT=5000
```
Run the backend:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Deployment
This app is ready to be deployed on platforms like Vercel (Frontend) and Render/Railway (Backend).
