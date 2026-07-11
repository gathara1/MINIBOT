const { cmd } = require('../inconnuboy');
const config = require('../config');
const moment = require('moment-timezone');

cmd({
    pattern: "ping",
    desc: "iOS style speed check",
    category: "main",
    filename: __filename
}, async (conn, m, mek, { from, sender, reply }) => {
    try {
        const start = Date.now();
        await conn.sendMessage(from, { react: { text: "⚡", key: mek.key } });
        const end = Date.now();
        
        // Clean iOS-style text layout
        const speedMessage = `*ᴘɪɴɢ ꜱᴛᴀᴛᴜꜱ* 🚀\n\n*ʟᴀᴛᴇɴᴄʏ:* ${end - start}ms\n*ꜱᴛᴀᴛᴜꜱ:* Online`;

        // iOS-style vCard (Professional & Minimalist)
        const iosvCard = {
            key: {
                fromMe: false,
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: " NAPPIER-XMD",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:NAPPIER-XMD\nTEL;type=CELL;type=VOICE;waid=254735638957:+254735638957\nEND:VCARD`
                }
            }
        };

        // iOS Newsletter/Ad Context (No big image, very clean)
        const iosContext = {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.NEWSLETTER_JID || '120363421104812135@newsletter',
                newsletterName: "NAPPIER-XMD NETWORK",
                serverMessageId: 1
            },
            externalAdReply: {
                title: " NAPPIER-XMD SYSTEMS",
                body: "ᴀɴᴀʟʏᴢɪɴɢ ʀᴇꜱᴘᴏɴꜱᴇ ᴛɪᴍᴇ...",
                mediaType: 1,
                renderLargerThumbnail: false,
                thumbnailUrl: "https://files.catbox.moe/99ofzd.jpg",
                sourceUrl: "https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y"
            }
        };

        await conn.sendMessage(from, { 
            text: speedMessage, 
            contextInfo: iosContext 
        }, { quoted: iosvCard });

    } catch (err) {
        console.error("PING ERROR:", err);
        reply("❌ *System Error.*");
    }
});