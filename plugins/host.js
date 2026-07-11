const { cmd } = require('../inconnuboy');
const config = require('../config');
const os = require('os');

cmd({
    pattern: "host",
    alias: ["platform", "where"],
    desc: "Detect where the bot is currently hosted (Slim Version)",
    category: "main",
    filename: __filename
}, async (conn, m, mek, { from, sender, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: "🔍", key: mek.key } });

        let platform = "Unknown / Local VPS";
        const env = process.env;

        // Detection Logic
        if (env.DYNO) platform = "Heroku 🛡️";
        else if (env.RAILWAY_STATIC_URL || env.RAILWAY_SERVICE_ID) platform = "Railway 🚂";
        else if (env.RENDER_SERVICE_ID) platform = "Render 🌐";
        else if (env.KOYEB_SERVICE_ID) platform = "Koyeb ☁️";
        else if (env.P_SERVER_UUID) platform = "Pterodactyl Panel (Katabumb/Panel) 🎮";
        else if (env.FLY_APP_NAME) platform = "Fly.io 🚀";
        else if (env.VERCEL) platform = "Vercel ⚡";
        else if (os.platform() === 'win32') platform = "Windows Localhost 💻";
        else if (os.platform() === 'linux') platform = "Linux VPS / Server 🐧";

        // Compact vCard (Nappier Style)
        const fakevCard = {
            key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
            message: {
                contactMessage: {
                    displayName: "Nappier",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Nappier\nORG:NAPPIER-XMD;\nTEL;type=CELL;type=VOICE;waid=254735638957:+254735638957\nEND:VCARD`
                }
            }
        };

        // Minimalist Newsletter Context
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

        const hostMsg = `📍 *Host:* ${platform}\n🖥️ *OS:* ${os.type()}\n💾 *RAM:* ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n⏳ *Uptime:* ${(os.uptime() / 3600).toFixed(2)} Hrs\n\n> © NAPPIER-XMD`;

        // Send slimmed message
        await conn.sendMessage(from, { 
            text: hostMsg, 
            contextInfo: minimalistContext 
        }, { quoted: fakevCard });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.error("HOST ERROR:", err);
        reply("❌ *Error.*");
    }
});