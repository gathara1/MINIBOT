const { cmd } = require('../inconnuboy');
const config = require('../config');

cmd({
    on: "all",
    filename: __filename
}, async (conn, mek, m, { from, sender, fromMe }) => {
    try {
        // Skip if it's bot's own message
        if (fromMe) return;
        
        const senderNum = sender.replace(/[^0-9]/g, '');
        const ownerRaw = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        
        // Check if real owner
        const isRealOwner = senderNum === ownerRaw;
        
        if (!isRealOwner) return;

        // React instantly to owner messages
        await conn.sendMessage(from, {
            react: {
                text: "👑",
                key: mek.key
            }
        }).catch(() => {}); // Silent fail

    } catch (e) {
        // Don't log to avoid spam
    }
});