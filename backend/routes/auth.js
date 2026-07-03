const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const { nanoid } = require("nanoid");
const upload = require("../middleware/upload");

router.post("/profile-pic", auth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const user = await User.findByIdAndUpdate(req.user.id, { profilePic: req.file.path }, { new: true }).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/users", auth, async (req, res) => {
    try {
        const users = await User.find({ username: { $ne: req.user.username } }).select("username bio profilePic isOnline lastSeen customId");
        
        // Ensure all fetched users have IDs (fix for old users in list)
        const updatedUsers = await Promise.all(users.map(async (u) => {
            if (!u.customId) {
                const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
                u.customId = `Pesu${randomPart}`;
                await User.findByIdAndUpdate(u._id, { customId: u.customId });
            }
            return u;
        }));
        
        res.json(updatedUsers);
    } catch (err) {
        console.error("Users error", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get friend list
router.get("/friends", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const friends = await User.find({ username: { $in: user.friends } }).select("username bio profilePic isOnline lastSeen customId");
        res.json(friends);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send friend request
router.post("/friend-request", auth, async (req, res) => {
    try {
        const { targetCustomId } = req.body;
        const targetUser = await User.findOne({ customId: targetCustomId });
        if (!targetUser) return res.status(404).json({ error: "User not found" });
        if (targetUser.username === req.user.username) return res.status(400).json({ error: "Cannot add yourself" });
        
        // Check if already friends
        if (targetUser.friends.includes(req.user.username)) return res.status(400).json({ error: "Already friends" });

        // Check if request already exists
        const existingRequest = targetUser.friendRequests.find(r => r.from === req.user.username);
        if (existingRequest) return res.status(400).json({ error: "Request already sent" });

        targetUser.friendRequests.push({ from: req.user.username });
        await targetUser.save();
        res.json({ message: "Friend request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Respond to friend request
router.post("/friend-request/respond", auth, async (req, res) => {
    try {
        const { fromUsername, action } = req.body; // action: 'accept' or 'reject'
        const user = await User.findById(req.user.id);
        
        const requestIndex = user.friendRequests.findIndex(r => r.from === fromUsername && r.status === 'pending');
        if (requestIndex === -1) return res.status(404).json({ error: "Request not found" });

        if (action === 'accept') {
            user.friendRequests[requestIndex].status = 'accepted';
            user.friends.push(fromUsername);
            
            // Add current user to sender's friend list too
            const sender = await User.findOne({ username: fromUsername });
            sender.friends.push(user.username);
            await sender.save();
        } else {
            user.friendRequests[requestIndex].status = 'rejected';
        }

        await user.save();
        res.json({ message: `Friend request ${action}ed` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/profile", auth, async (req, res) => {
    try {
        let user = await User.findById(req.user.id).select("-password");
        
        // If user doesn't have a customId (old users), generate one now
        if (!user.customId) {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let randomPart = '';
            for (let i = 0; i < 5; i++) {
                randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            user.customId = `Pesu${randomPart}`;
            await user.save();
        }
        
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Block User
router.post("/block", auth, async (req, res) => {
    try {
        const { targetUsername } = req.body;
        const user = await User.findById(req.user.id);
        if (!user.blockedUsers.includes(targetUsername)) {
            user.blockedUsers.push(targetUsername);
            await user.save();
        }
        res.json({ message: "User blocked" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Unblock User
router.post("/unblock", auth, async (req, res) => {
    try {
        const { targetUsername } = req.body;
        const user = await User.findById(req.user.id);
        user.blockedUsers = user.blockedUsers.filter(u => u !== targetUsername);
        await user.save();
        res.json({ message: "User unblocked" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/profile", auth, async (req, res) => {
    try {
        const { username, bio, profilePic } = req.body;
        const updateData = { bio, profilePic };
        
        if (username) {
            const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
            if (existingUser) return res.status(400).json({ error: "Username already taken" });
            updateData.username = username;
        }

        const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/register", async (req, res) => {

    try {
        const { username, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        
        // Generate PesuXXXXX format (X = random uppercase letters/numbers)
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomPart = '';
        for (let i = 0; i < 5; i++) {
            randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const customId = `Pesu${randomPart}`;
        
        const user = await User.create({ username, password: hashed, customId });
        res.json({ message: "User created successfully" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: "Username already exists or ID collision" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: "User not found" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: "Invalid password" });
        const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: "1d",});
        res.json({ token, username });
    } catch (err) {
        console.error("LOGIN ERROR", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;