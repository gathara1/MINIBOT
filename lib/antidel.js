const mongoose = require('mongoose');
const config = require('../config');

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

// Handle Anti-Delete
const AntiDelete = async (conn, updates) => {
    try {
        for (const update of updates) {
            if (update.key.fromMe) continue;

            const isRevoke = update.update.messageStubType === 68 || 
                             (update.update.message && 
                              update.update.message.protocolMessage && 
                              update.update.message.protocolMessage.type === 0);

            if (isRevoke) {
                const chatId = update.key.remoteJid;
                const messageId = update.key.id;
                const participant = update.key.participant || chatId;

                const isEnabled = await getAnti(chatId);
                if (!isEnabled) return;

                if (config.ANTI_DELETE_MODE === 'false') return;

                const alertText = `
🚫 *ANTI-DELETE DETECTED* 🚫
👤 *User:* @${participant.split('@')[0]}
📅 *Date:* ${new Date().toLocaleString()}
> ${config.BOT_FOOTER || ''}
`;
                try {
                    await conn.sendMessage(chatId, { text: alertText, mentions: [participant] });
                } catch (e) {
                    console.error('❌ Error sending anti-delete alert:', e);
                }
            }
        }
    } catch (e) { 
        console.error("Antidelete Error:", e); 
    }
};

// Delete Text Message
const DeletedText = async (mek) => {
    try {
        return mek.message?.protocolMessage?.editedMessage?.conversation || null;
    } catch (e) {
        return null;
    }
};

// Delete Media Message
const DeletedMedia = async (mek) => {
    try {
        return mek.message?.protocolMessage?.editedMessage?.imageMessage || null;
    } catch (e) {
        return null;
    }
};

module.exports = {
    AntiDelDB,
    initializeAntiDeleteSettings,
    setAnti,
    getAnti,
    getAllAntiDeleteSettings,
    AntiDelete,
    DeletedText,
    DeletedMedia
};
