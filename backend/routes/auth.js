const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

router.get("/users", auth, async (req, res) => {
    try {
        const users = await User.find({ username: { $ne: req.user.username } }).select("username");
        res.json(users);
    } catch (err) {
        console.error("Users error", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post("/register", async (req, res) => {

    try {
        const { username, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashed });
        res.json({ message: "User created successfully" });
    } catch (err) {
        res.status(400).json({ error: "Username already exists" });
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