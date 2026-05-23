require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/messages", require("./routes/messages"));

// Socket.io logic
const users = {}; // Map username to socket.id

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("register", (username) => {
        users[username] = socket.id;
        console.log(`User ${username} registered with socket ${socket.id}`);
    });

    socket.on("send_message", async (data) => {
        const { sender, receiver, text } = data;
        
        // Save to DB
        const newMessage = await Message.create({ sender, receiver, text });

        // Emit to receiver if online
        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive_message", newMessage);
        }
        
        // Emit back to sender
        socket.emit("receive_message", newMessage);
    });

    socket.on("disconnect", () => {
        for (let username in users) {
            if (users[username] === socket.id) {
                delete users[username];
                break;
            }
        }
        console.log("User disconnected");
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB (Local)"))
    .catch((err) => {
        console.error("Local MongoDB connection error:");
        console.error(err);
    });

