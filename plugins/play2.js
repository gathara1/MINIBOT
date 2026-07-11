const { cmd } = require('../inconnuboy');
const axios = require('axios');
const config = require('../config');

cmd({
    pattern: "play2",
    alias: ["song2", "audio"],
    desc: "YouTube Audio Player (Elite Engine)",
    category: "download",
    filename: __filename
}, async (conn, m, mek, { from, q, reply, sender, body }) => {
    try {
        if (!q && body.includes(" ")) q = body.split(" ").slice(1).join(" ");
        if (!q) return reply(" *ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ sᴏɴɢ ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ.*");

        await conn.sendMessage(from, { react: { text: "⚡", key: mek.key } });

        const iosvCard = {
            key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
            message: {
                contactMessage: {
                    displayName: " NAPPIER-XMD MUSIC",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN: NAPPIER-XMD\nTEL;type=CELL;type=VOICE;waid=254735638957:+254735638957\nEND:VCARD`
                }
            }
        };

        const searchRes = await axios.get(`https://api.vreden.my.id/api/v1/download/play/audio?query=${encodeURIComponent(q)}`);
        if (!searchRes.data.status || !searchRes.data.result.metadata) {
            return reply("❌ *ꜱᴏɴɢ ɴᴏᴛ ꜰᴏᴜɴᴅ.*");
        }

        const meta = searchRes.data.result.metadata;

        // Cleanest iOS UI layout
        const playCaption = `* ɴᴏᴡ ᴘʟᴀʏɪɴɢ* 🎶\n\n` +
                            `*ᴛɪᴛʟᴇ:* ${meta.title}\n` +
                            `*ᴜᴘʟᴏᴀᴅᴇʀ:* ${meta.author.name}\n` +
                            `*ᴅᴜʀᴀᴛɪᴏɴ:* ${meta.timestamp}\n\n` +
                            `> *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ꜰʀᴏᴍ ᴇʟɪᴛᴇ ꜱᴇʀᴠᴇʀ...*`;

        await conn.sendMessage(from, {
            image: { url: meta.thumbnail || meta.image },
            caption: playCaption,
            contextInfo: {
                mentionedJid: [sender],
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTER_JID || '120363421104812135@newsletter',
                    newsletterName: "NAPPIER-XMD MUSIC",
                    serverMessageId: 1
                },
                externalAdReply: {
                    title: " NAPPIER-XMD MEDIA ENGINE",
                    body: "ʀᴇᴀᴅʏ ꜰᴏʀ ᴅᴏᴡɴʟᴏᴀᴅ",
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    thumbnailUrl: meta.thumbnail || meta.image,
                    sourceUrl: "https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y"
                }
            }
        }, { quoted: iosvCard });

        const downloadRes = await axios.get(`https://eliteprotech-apis.zone.id/ytmp3?url=${encodeURIComponent(meta.url)}`);
        const finalAudioUrl = downloadRes.data.result?.download;

        if (finalAudioUrl && finalAudioUrl.startsWith('http')) {
            await conn.sendMessage(from, { 
                audio: { url: finalAudioUrl }, 
                mimetype: 'audio/mpeg',
                fileName: `${meta.title}.mp3`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } else {
            reply("❌ *ᴇʀʀᴏʀ:* ᴜɴᴀʙʟᴇ ᴛᴏ ꜰᴇᴛᴄʜ ᴀᴜᴅɪᴏ.");
        }
    } catch (err) {
        reply("❌ *ꜰᴀᴛᴀʟ ᴇʀʀᴏʀ.*");
    }
});