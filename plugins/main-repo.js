const axios = require('axios');
const { cmd } = require('../inconnuboy');
const config = require('../config');

cmd({
    pattern: "repo",
    alias: ["git", "sc", "script"],
    desc: "Fetch the bot repository details",
    category: "main",
    react: "👑",
    filename: __filename
},
async (conn, mek, m, { from, reply, sender }) => {
    try {
        // Loading message
        let loading = await conn.sendMessage(from, {
            text: '*Fetching repo details...* 👑'
        }, { quoted: mek });

        const repoUrl = "https://github.com/gathara1/NAPPIER-XMD";
        const apiUrl = "https://api.github.com/repos/gathara1/NAPPIER-XMD";

        const response = await axios.get(apiUrl, {
            headers: { 'User-Agent': 'NAPPIER-XMD' },
            timeout: 10000
        });
        const data = response.data;

        let repoMsg = `╭─「 *NAPPIER-XMD* 」
│
│ 🧬 *Repo:* ${data.name}
│ 👤 *Owner:* ${data.owner.login}
│ 📝 *Desc:* ${data.description || 'No description'}
│ 💻 *Language:* ${data.language || 'N/A'}
│
│ ⭐ *Stars:* ${data.stargazers_count}
│ 🍴 *Forks:* ${data.forks_count}
│ 👀 *Watchers:* ${data.watchers_count}
│ 📅 *Updated:* ${new Date(data.updated_at).toLocaleDateString()}
│
│ 🔗 *Link:* ${repoUrl}
│
╰─「 Requested by @${sender.split('@')[0]} 」`;

        const fakevCard = {
            key: {
                fromMe: false,
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: "NAPPIER-XMD",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:NAPPIER-XMD\nORG:NAPPIER-XMD;\nTEL;type=CELL;type=VOICE;waid=254735638957:+254735638957\nEND:VCARD`
                }
            }
        };

        const newsletterContextInfo = {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.NEWSLETTER_JID || '120363421104812135@newsletter',
                newsletterName: config.OWNER_NAME || 'NAPPIER-XMD',
                serverMessageId: 1
            }
        };

        const imgUrl = 'https://files.catbox.moe/99ofzd.jpg';

        try {
            await conn.sendMessage(from, {
                image: { url: imgUrl },
                caption: repoMsg,
                contextInfo: newsletterContextInfo,
                mentions: [sender]
            }, { quoted: fakevCard });
        } catch (imgErr) {
            console.log("Repo image failed, sending text only:", imgErr.message);
            await conn.sendMessage(from, {
                text: repoMsg,
                contextInfo: newsletterContextInfo,
                mentions: [sender]
            }, { quoted: fakevCard });
        }

    } catch (e) {
        console.error(e);
        reply("❌ Failed to fetch repo data. Try again later.");
    }
});