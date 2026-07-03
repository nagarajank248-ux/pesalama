const router = require("express").Router();
const Message = require("../models/Message");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

// Upload image
router.post("/upload", auth, upload.single("image"), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        res.json({ url: req.file.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get call history
router.get("/calls/history", auth, async (req, res) => {
    try {
        const username = req.user.username;
        const calls = await Message.find({
            messageType: 'call',
            deletedFor: { $ne: username },
            $or: [
                { sender: username },
                { receiver: username }
            ]
        }).sort({ createdAt: -1 });

        res.json(calls);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get chat history between two users
router.get("/:receiver", auth, async (req, res) => {
    try {
        const { receiver } = req.params;
        const sender = req.user.username;

        const messages = await Message.find({
            isGroup: false,
            deletedFor: { $ne: req.user.username },
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get group messages
router.get("/group/:groupId", auth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const messages = await Message.find({ groupId, isGroup: true, deletedFor: { $ne: req.user.username } }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear chat history with a specific user
router.delete("/clear/:receiver", auth, async (req, res) => {
    try {
        const { receiver } = req.params;
        const sender = req.user.username;

        await Message.deleteMany({
            isGroup: false,
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender }
            ]
        });

        res.json({ message: "Chat history cleared" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a single message
router.delete("/:messageId", auth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });
        if (message.sender !== req.user.username) return res.status(403).json({ error: "Unauthorized" });

        await Message.findByIdAndDelete(messageId);
        res.json({ message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a single message for me
router.delete("/delete-for-me/:messageId", auth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: "Message not found" });

        await Message.findByIdAndUpdate(messageId, {
            $addToSet: { deletedFor: req.user.username }
        });
        
        res.json({ message: "Message deleted for me" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unread counts for all conversations
router.get("/unread/counts", auth, async (req, res) => {
    try {
        const username = req.user.username;
        const unreadCounts = await Message.aggregate([
            { 
                $match: { 
                    receiver: username, 
                    status: { $ne: 'read' },
                    isGroup: false
                } 
            },
            { 
                $group: { 
                    _id: "$sender", 
                    count: { $sum: 1 } 
                } 
            }
        ]);
        
        const counts = {};
        unreadCounts.forEach(item => {
            counts[item._id] = item.count;
        });
        
        res.json(counts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
