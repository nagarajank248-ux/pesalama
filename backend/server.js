require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message");
const User = require("./models/User");

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
app.use("/api/groups", require("./routes/groups"));

// Socket.io logic
const users = {}; // Map username to socket.id

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("register", async (username) => {
        users[username] = socket.id;
        await User.findOneAndUpdate({ username }, { isOnline: true });
        socket.broadcast.emit("user_status_change", { username, isOnline: true });
        console.log(`User ${username} registered with socket ${socket.id}`);
    });

    socket.on("send_message", async (data) => {
        const { sender, receiver, text, messageType } = data;
        
        // Save to DB
        const newMessage = await Message.create({ sender, receiver, text, messageType: messageType || 'text' });

        // Emit to receiver if online
        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive_message", newMessage);
        }
        
        // Emit back to sender
        socket.emit("receive_message", newMessage);
    });

    socket.on("typing", (data) => {
        const { sender, receiver } = data;
        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("user_typing", { sender });
        }
    });

    socket.on("stop_typing", (data) => {
        const { sender, receiver } = data;
        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("user_stop_typing", { sender });
        }
    });

    socket.on("mark_read", async (data) => {
        const { messageId, sender } = data;
        await Message.findByIdAndUpdate(messageId, { status: 'read' });
        const senderSocketId = users[sender];
        if (senderSocketId) {
            io.to(senderSocketId).emit("message_read", { messageId });
        }
    });

    socket.on("join_group", (groupId) => {
        socket.join(groupId);
        console.log(`User joined group ${groupId}`);
    });

    socket.on("send_group_message", async (data) => {
        const { sender, groupId, text, messageType } = data;
        const newMessage = await Message.create({ sender, groupId, text, isGroup: true, messageType: messageType || 'text' });
        io.to(groupId).emit("receive_message", newMessage);
    });

    socket.on("disconnect", async () => {
        for (let username in users) {
            if (users[username] === socket.id) {
                await User.findOneAndUpdate({ username }, { isOnline: false, lastSeen: Date.now() });
                socket.broadcast.emit("user_status_change", { username, isOnline: false, lastSeen: Date.now() });
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
