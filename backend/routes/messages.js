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

// Get chat history between two users
router.get("/:receiver", auth, async (req, res) => {
    try {
        const { receiver } = req.params;
        const sender = req.user.username;

        const messages = await Message.find({
            isGroup: false,
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
        const messages = await Message.find({ groupId, isGroup: true }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
