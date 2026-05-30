const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        default: ""
    },
    profilePic: {
        type: String,
        default: ""
    },
    customId: {
        type: String,
        unique: true,
        required: true
    },
    friends: [{
        type: String, // usernames or customIds
    }],
    friendRequests: [{
        from: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        }
    }],
    blockedUsers: [{
        type: String, // usernames
    }],
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
},
    { timestamps: true },
);


module.exports = mongoose.model('User', userSchema);