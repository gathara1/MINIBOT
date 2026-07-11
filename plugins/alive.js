const { cmd } = require('../inconnuboy');
const config = require('../config');
const os = require('os');
const process = require('process');

const imgUrl = 'https://files.catbox.moe/99ofzd.jpg';

// Ping Command
cmd({
    pattern: "ping",
    desc: "Check bot latency",
    category: "general",
    react: "⚡"
},
async(conn, mek, m, { from, sender, reply }) => {
    try {
        // Loading message
        let loading = await conn.sendMessage(from, {
            text: '*NAPPIER-XMD Loading...* ⚡'
        }, { quoted: mek });

        const start = Date.now();
        await conn.sendPresenceUpdate('composing', from);
        const ping = Date.now() - start;

        await new Promise(resolve => setTimeout(resolve, 800));

        let text = `╭─「 *NAPPIER-XMD SPEED* 」
│
│ ⚡ *Status:* Online
│ 🚀 *Latency:* ${ping}ms
│ 🖥️ *Platform:* ${os.platform()}
│
╰─「 Requested by @${sender.split('@')[0]} 」`;

        await conn.sendMessage(from, {
            text,
            mentions: [sender]
        }, { quoted: loading });

    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});

// Alive Command
cmd({
    pattern: "alive",
    desc: "Check if bot is alive",
    category: "general",
    react: "🤖"
},
async(conn, mek, m, { from, sender, reply }) => {
    try {
        let loading = await conn.sendMessage(from, {
            text: '*NAPPIER-XMD Loading...* 🤖'
        }, { quoted: mek });

        let uptime = process.uptime();
        let hours = Math.floor(uptime / 3600);
        let minutes = Math.floor((uptime % 3600) / 60);
        let seconds = Math.floor(uptime % 60);

        // Ping
        const start = Date.now();
        await conn.sendPresenceUpdate('composing', from);
        const ping = Date.now() - start;

        await new Promise(resolve => setTimeout(resolve, 1000));

        let text = `╭─「 *NAPPIER-XMD* 」
│
│ 🤖 *Status:* Online ✅
│ 👑 *Owner:* lycifer
│ ⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
│ 🚀 *Latency:* ${ping}ms
│ 💾 *RAM:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB
│ 🖥️ *Platform:* ${os.platform()}
│
╰─「 Requested by @${sender.split('@')[0]} 」`;

        try {
            await conn.sendMessage(from, {
                image: { url: imgUrl },
                caption: text,
                mentions: [sender]
            }, { quoted: loading });
        } catch (imgErr) {
            console.log("Image failed, sending text only:", imgErr.message);
            await conn.sendMessage(from, {
                text: text,
                mentions: [sender]
            }, { quoted: loading });
        }

    } catch (e) {
        console.log("ALIVE ERROR:", e);
        reply("Error: " + e.message);
    }
});