const { cmd } = require('../inconnuboy');
const config = require('../config');

cmd({
    pattern: "speed",
    alias: ["sp"],
    desc: "Check bot response speed (Compact Version)",
    category: "main",
    filename: __filename
}, async (conn, m, mek, { from, sender, reply }) => {
    try {
        const start = Date.now();
        
        // Quick reaction
        await conn.sendMessage(from, { react: { text: "⚡", key: mek.key } });
        
        const end = Date.now();
        const latency = end - start;

        // Compact vCard (Nappier Style)
        const fakevCard = {
            key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
            message: {
                contactMessage: {
                    displayName: "NAPPIER-XMD",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:NAPPIER-XMD\nORG:NAPPIER-XMD;\nTEL;type=CELL;type=VOICE;waid=254735638957:+254735638957\nEND:VCARD`
                }
            }
        };

        // Minimalist Newsletter Context (No image/preview)
        const minimalistContext = {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.NEWSLETTER_JID || '120363421104812135@newsletter',
                newsletterName: config.OWNER_NAME || 'NAPPIER-XMD',
                serverMessageId: 1
            }
        };

        // Clean Text output
        const speedMessage = `🚀 *Response:* ${latency}ms\n🛸 *Lag:* ${(latency / 12).toFixed(2)}ms\n\n> © NAPPIER-XMD`;

        // Send message without the large thumbnail
        await conn.sendMessage(from, { 
            text: speedMessage, 
            contextInfo: minimalistContext 
        }, { quoted: fakevCard });

    } catch (err) {
        console.error("SPEED ERROR:", err);
        reply("❌ *Error.*");
    }
});