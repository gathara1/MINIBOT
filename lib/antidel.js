const config = require('../config');

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
    AntiDelete,
    DeletedText,
    DeletedMedia
};
