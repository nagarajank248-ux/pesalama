const router = require("express").Router();
const Group = require("../models/Group");
const auth = require("../middleware/auth");

// Create a group
router.post("/", auth, async (req, res) => {
    try {
        const { name, members, description, profilePic } = req.body;
        const group = await Group.create({
            name,
            members: [...new Set([...members, req.user.username])],
            description,
            profilePic,
            admin: req.user.username
        });
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all groups for a user
router.get("/", auth, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user.username });
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a group
router.delete("/:groupId", auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });
        if (group.admin !== req.user.username) return res.status(403).json({ error: "Only admin can delete group" });

        await Group.findByIdAndDelete(req.params.groupId);
        res.json({ message: "Group deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get group messages (I'll reuse the Message model for group messages by adding a groupId field)
module.exports = router;
