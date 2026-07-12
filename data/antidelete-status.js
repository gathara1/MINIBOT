const mongoose = require('mongoose');

// Antidelete Status Schema
const antideleteSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const AntideleteModel = mongoose.model('Antidelete', antideleteSchema);

// Get Antidelete Status
const getAntideleteStatus = async (chatId) => {
    try {
        const result = await AntideleteModel.findOne({ chatId });
        return result ? result.enabled : false;
    } catch (e) {
        console.error('❌ Error getting antidelete status:', e);
        return false;
    }
};

// Set Antidelete Status
const setAntideleteStatus = async (chatId, enabled) => {
    try {
        await AntideleteModel.findOneAndUpdate(
            { chatId },
            { enabled, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('❌ Error setting antidelete status:', e);
        return false;
    }
};

// Get All Enabled Antidelete Chats
const getAllAntideleteChats = async () => {
    try {
        return await AntideleteModel.find({ enabled: true });
    } catch (e) {
        console.error('❌ Error getting all antidelete chats:', e);
        return [];
    }
};

module.exports = {
    getAntideleteStatus,
    setAntideleteStatus,
    getAllAntideleteChats,
    AntideleteModel
};
