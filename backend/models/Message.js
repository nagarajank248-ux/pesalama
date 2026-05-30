const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    receiver: {
        type: String,
        required: false // Optional for group messages
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: false
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    text: {
        type: String,
        required: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);