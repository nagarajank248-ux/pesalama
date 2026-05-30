const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    members: [{
        type: String, // usernames
    }],
    admin: {
        type: String, // admin username
        required: true
    },
    profilePic: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema);
