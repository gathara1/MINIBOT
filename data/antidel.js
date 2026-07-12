const mongoose = require('mongoose');

// Anti-Delete Database Schema
const antiDeleteSchema = new mongoose.Schema({
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
    }
});

const AntiDelDB = mongoose.model('AntiDelete', antiDeleteSchema);

// Initialize Anti-Delete Settings
const initializeAntiDeleteSettings = async () => {
    try {
        console.log('✅ Anti-Delete settings initialized');
    } catch (e) {
        console.error('❌ Anti-Delete initialization error:', e);
    }
};

// Set Anti-Delete Status
const setAnti = async (chatId, enabled) => {
    try {
        await AntiDelDB.findOneAndUpdate(
            { chatId },
            { enabled },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('❌ Error setting anti-delete:', e);
        return false;
    }
};

// Get Anti-Delete Status
const getAnti = async (chatId) => {
    try {
        const result = await AntiDelDB.findOne({ chatId });
        return result ? result.enabled : false;
    } catch (e) {
        console.error('❌ Error getting anti-delete status:', e);
        return false;
    }
};

// Get All Anti-Delete Settings
const getAllAntiDeleteSettings = async () => {
    try {
        return await AntiDelDB.find({ enabled: true });
    } catch (e) {
        console.error('❌ Error getting all anti-delete settings:', e);
        return [];
    }
};

module.exports = {
    AntiDelDB,
    initializeAntiDeleteSettings,
    setAnti,
    getAnti,
    getAllAntiDeleteSettings
};
