const { cmd } = require('../inconnuboy');
const config = require('../config');

cmd({
    pattern: "tagall",
    alias: ["everyone", "all", "tag"],
    desc: "Tag all members - admins only",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, args, q, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command only works in groups!");

        const groupMetadata = await conn.groupMetadata(from);
        const participants = groupMetadata.participants;
        
        // Check if sender is admin or super admin
        const senderId = m.sender;
        const participant = groupMetadata.participants.find(p => p.id === senderId);
        const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        
        if (!isAdmin) return reply("❌ Only group admins can use this command!");

        await conn.sendMessage(from, { react: { text: "📣", key: mek.key } });

        let mentions = participants.map(p => p.id);
        let tagMessage = `*📢 NAPPIER-XMD Announcement🧸*\n\n`;
        
        tagMessage += `${q || 'Attention everyone!'}\n\n`;
        tagMessage += `*From:* @${senderId.split('@')[0]}\n`;
        tagMessage += `*Members:* ${participants.length}\n\n`;
        tagMessage += `*Tagging everyone:*\n`;
        
        // Add mentions inline
        for (let id of mentions) {
            tagMessage += `@${id.split('@')[0]} `;
        }

        tagMessage += `\n\n_~ Powered by NAPPIER-XMD 🇰🇪_`;

        const newsletterContextInfo = {
            mentionedJid: mentions,
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.NEWSLETTER_JID || '120363421104812135@newsletter',
                newsletterName: config.OWNER_NAME || 'NAPPIER-XMD',
                serverMessageId: 1
            }
        };

        await conn.sendMessage(from, { 
            image: { url: 'https://files.catbox.moe/99ofzd.jpg' }, 
            caption: tagMessage, 
            mentions: mentions,
            contextInfo: newsletterContextInfo
        }, { quoted: mek });

    } catch (err) {
        console.error("TAGALL ERROR:", err);
        reply("❌ Failed to tag all members.");
    }
});