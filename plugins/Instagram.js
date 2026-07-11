const { cmd } = require("../inconnuboy");
const { igdl } = require("ruhend-scraper");
const config = require("../config");

// Set to prevent duplicate processing
const processedMessages = new Set();

// VERIFIED CONTACT (Nappier style)
const verifiedContact = {
    key: {
        fromMe: false,
        participant: `0@s.whatsapp.net`,
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "NAPPIER-XMD VERIFIED ✅",
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:NAPPIER-XMD VERIFIED
ORG:NAPPIER-XMD BOT;
TEL;type=CELL;type=VOICE;waid:${config.OWNER_NUMBER || "254735638957"}:+${config.OWNER_NUMBER || "254735638957"}
END:VCARD`
        }
    }
};

// Newsletter / forwarding context
const newsletterContext = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363421104812135@newsletter',
            newsletterName: 'NAPPIER-XMD',
            serverMessageId: 143
        }
    }
};

cmd({
    pattern: "instagram",
    alias: ["ig", "igdl", "instalink"],
    desc: "Download Instagram video or image",
    category: "downloader",
    react: "📎",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (processedMessages.has(m.key.id)) return;
        processedMessages.add(m.key.id);
        setTimeout(() => processedMessages.delete(m.key.id), 5 * 60 * 1000);

        const text = q?.trim() || m.message?.conversation || m.message?.extendedTextMessage?.text;

        if (!text) {
            return await conn.sendMessage(from, {
                text: `╭──〔 📎 ɪɴsᴛᴀɢʀᴀᴍ ʟɪɴᴋ ᴍɪssɪɴɢ 〕──
│
├─ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ɪɴsᴛᴀɢʀᴀᴍ ᴠɪᴅᴇᴏ ʟɪɴᴋ.
│
╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
                ...newsletterContext
            }, { quoted: verifiedContact });
        }

        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(text));

        if (!isValidUrl) {
            return await conn.sendMessage(from, {
                text: `╭──〔 ❌ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ 〕──
│
├─ ᴛʜᴀᴛ ɪs ɴᴏᴛ ᴀ ᴠᴀʟɪᴅ ɪɴsᴛᴀɢʀᴀᴍ ᴘᴏsᴛ, ʀᴇᴇʟ, ᴏʀ ᴛᴠ ʟɪɴᴋ.
│
╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
                ...newsletterContext
            }, { quoted: verifiedContact });
        }

        // React while processing
        await conn.sendMessage(from, { react: { text: '🔄', key: m.key } });

        // Download media
        const downloadData = await igdl(text);

        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return await conn.sendMessage(from, {
                text: `╭──〔 ⚠️ ɴᴏ ᴍᴇᴅɪᴀ ꜰᴏᴜɴᴅ 〕──
│
├─ ᴛʜᴇʀᴇ ᴡᴀs ɴᴏ ᴍᴇᴅɪᴀ ᴀᴛ ᴛʜᴇ ᴘʀᴏᴠɪᴅᴇᴅ ʟɪɴᴋ.
│
╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
                ...newsletterContext
            }, { quoted: verifiedContact });
        }

        const mediaData = downloadData.data;
        for (let i = 0; i < Math.min(20, mediaData.length); i++) {
            const media = mediaData[i];
            const mediaUrl = media.url;

            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) ||
                            media.type === 'video' ||
                            text.includes('/reel/') ||
                            text.includes('/tv/');

            if (isVideo) {
                await conn.sendMessage(from, {
                    video: { url: mediaUrl },
                    mimetype: "video/mp4",
                    caption: `╭──〔 🎬 ɪɴsᴛᴀ ᴠɪᴅᴇᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ 〕──
│
├─ ꜱᴏᴜʀᴄᴇ: ɪɴsᴛᴀɢʀᴀᴍ.ᴄᴏᴍ
├─ ꜱᴛᴀᴛᴜs: ✅ ᴄᴏᴍᴘʟᴇᴛᴇ
│
╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
                    ...newsletterContext
                }, { quoted: verifiedContact });
            } else {
                await conn.sendMessage(from, {
                    image: { url: mediaUrl },
                    caption: `╭──〔 🖼️ ɪɴsᴛᴀ ɪᴍᴀɢᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ 〕──
│
├─ ꜱᴏᴜʀᴄᴇ: ɪɴsᴛᴀɢʀᴀᴍ.ᴄᴏᴍ
├─ ꜱᴛᴀᴛᴜs: ✅ ᴄᴏᴍᴘʟᴇᴛᴇ
│
╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
                    ...newsletterContext
                }, { quoted: verifiedContact });
            }
        }

    } catch (error) {
        console.error('❌ Error in Instagram command:', error);
        await conn.sendMessage(from, {
            text: `╭──〔 ⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ 〕──
 │
 ├─ ꜱᴏᴍᴇᴛʜɪɴɢ ᴡᴇɴᴛ ᴡʀᴏɴɢ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ᴛʜᴇ ʟɪɴᴋ.
 │
 ╰──〔 📥 ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD 〕──`,
            ...newsletterContext
        }, { quoted: verifiedContact });
    }
});