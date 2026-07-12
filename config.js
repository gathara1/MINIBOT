const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

module.exports = {
    // ===========================================================
    // 1. BASE CONFIGURATION
    // ===========================================================
    SESSION_ID: process.env.SESSION_ID || "NAPPIER-XMD",
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://karmahell33_db_user:FdVaBDQOZj3qpCsn@cluster0.sjpgsqj.mongodb.net/?appName=Cluster0',

    // ===========================================================
    // 2. BOT INFORMATION
    // ===========================================================
    PREFIX: process.env.PREFIX || '.',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '+254735638957',
    OWNER_NAME: process.env.OWNER_NAME || 'lycifer',
    BOT_NAME: "NAPPIER-XMD",
    BOT_FOOTER: '⚡ Powered by NAPPIER-XMD',
    WORK_TYPE: process.env.WORK_TYPE || "public",
    VERSION: process.env.VERSION || "2.0.0",

    // ===========================================================
    // 3. AUTO FEATURES - SAFE ONLY
    // ===========================================================
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || 'false',  // ⚠️ Disabled - Can trigger detection
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || 'false',  // ⚠️ Disabled - Can trigger detection
    AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '😍', '💞', '💕', '☺️', '🤗'],
    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || 'false',  // ⚠️ Disabled - Can trigger detection
    AUTO_REACT_STATUS: process.env.AUTO_REACT_STATUS || 'false', // ⚠️ Disabled - Can trigger detection
    AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || 'false',
    AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || '🤗',

    // ===========================================================
    // 4. CHAT & PRESENCE - DISABLED FOR BAN SAFETY
    // ===========================================================
    // ⚠️ WARNING: These features can trigger WhatsApp's bot detection!
    // Keep disabled unless you understand the ban risks
    READ_MESSAGE: process.env.READ_MESSAGE || 'false',
    AUTO_TYPING: process.env.AUTO_TYPING || 'false',       // 🔴 BAN RISK: Disabled
    AUTO_RECORDING: process.env.AUTO_RECORDING || 'false', // 🔴 BAN RISK: Disabled

    // ===========================================================
    // 5. GROUP MANAGEMENT
    // ===========================================================
    WELCOME_ENABLE: process.env.WELCOME_ENABLE || 'false',
    GOODBYE_ENABLE: process.env.GOODBYE_ENABLE || 'false',
    WELCOME_MSG: process.env.WELCOME_MSG || null,
    GOODBYE_MSG: process.env.GOODBYE_MSG || null,
    WELCOME_IMAGE: process.env.WELCOME_IMAGE || null,
    GOODBYE_IMAGE: process.env.GOODBYE_IMAGE || null,
    GROUP_INVITE_LINK: process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/CLClgqJIC59GrcI4sRzLu8',
    GROUP_LINK: process.env.GROUP_LINK || 'https://chat.whatsapp.com/CLClgqJIC59GrcI4sRzLu8',

    // ===========================================================
    // 6. SECURITY & ANTI-FEATURES
    // ===========================================================
    ANTI_CALL: process.env.ANTI_CALL || 'true',
    REJECT_MSG: process.env.REJECT_MSG || '*📵 NAPPIER-XMD doesn\'t accept calls*',
    ANTI_DELETE: process.env.ANTI_DELETE || 'true',

    // ===========================================================
    // 7. IMAGES & LINKS
    // ===========================================================
    IMAGE_PATH: 'https://files.catbox.moe/99ofzd.jpg',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y',
    WEB_PAIR_URL: 'https://nappiero-fbf4880816e4.herokuapp.com/',

    // ===========================================================
    // 8. 🔴 NEWSLETTER SETTINGS - REMOVED FROM ACTIVE CODE
    // ===========================================================
    // ⚠️ CRITICAL: Newsletter auto-follow and auto-react have been REMOVED
    // from inconnu.js to prevent bans. These remain in config.js only for reference.
    // 
    // DO NOT enable these - they will cause your account to be banned!
    // 
    // If you absolutely need newsletter features, use the official WhatsApp API instead
    NEWSLETTER_JID: process.env.NEWSLETTER_JID || '',
    ENABLE_AUTO_FOLLOW_NEWSLETTER: process.env.ENABLE_AUTO_FOLLOW_NEWSLETTER || 'false', // 🔴 BANNED FEATURE
    AUTO_JOIN_GROUP: process.env.AUTO_JOIN_GROUP || '',  // ⚠️ Can trigger detection

    // ===========================================================
    // 9. AUTO REACT SETTINGS - USE WITH CAUTION
    // ===========================================================
    AUTO_REACT_NUMBERS: process.env.AUTO_REACT_NUMBERS || '254735638957',
    AUTO_REACT_EMOJIS: process.env.AUTO_REACT_EMOJIS || '❤️,🔥,💯,👑,⚡',
    
    // 🔴 REMOVED: Newsletter channel reactions
    // CHANNEL_REACT and CHANNEL_REACT_EMOJIS have been removed from active code
    // They were causing frequent bans due to automated reactions
    CHANNEL_REACT: process.env.CHANNEL_REACT || 'false',              // 🔴 DISABLED - BANNED FEATURE
    CHANNEL_REACT_EMOJIS: process.env.CHANNEL_REACT_EMOJIS || '',    // 🔴 DISABLED - BANNED FEATURE

    // ===========================================================
    // 10. TELEGRAM BOT - GET NEW TOKEN FROM @BotFather
    // ===========================================================
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',

    // ===========================================================
    // 11. RECONNECT / SAFETY
    // ===========================================================
    // Maximum automatic restart attempts after disconnect to avoid tight restart loops.
    MAX_RESTARTS: process.env.MAX_RESTARTS || '5',
    // Base backoff in milliseconds (exponential backoff will be applied).
    RESTART_BACKOFF_MS: process.env.RESTART_BACKOFF_MS || '5000'
};
