const { cmd } = require('../inconnuboy');

// 1. REQUEST LIST
cmd({
    pattern: "requestlist",
    desc: "Shows pending group join requests",
    category: "group",
    react: "📋",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        if (!isGroup) return reply("❌ This command is for groups only.");
        if (!isAdmins) return reply("❌ Admin permissions required.");
        if (!isBotAdmins) return reply("❌ I need admin rights to see requests.");

        const requests = await conn.groupRequestParticipantsList(from);
        
        if (requests.length === 0) {
            await conn.sendMessage(from, { react: { text: 'ℹ️', key: m.key } });
            return reply("ℹ️ No pending requests found.");
        }

        let text = `*Pending Join Requests*\n\n`;
        requests.forEach((user, i) => {
            text += `  ${i + 1} 👤 @${user.jid.split('@')[0]}\n`;
        });
        text += `\n*Total:* ${requests.length} pending\n> Use .acceptall to approve.`;

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        return reply(text, { mentions: requests.map(u => u.jid) });
    } catch (error) {
        console.error("Request list error:", error);
        return reply("❌ Error fetching join requests.");
    }
});

// 2. ACCEPT ALL
cmd({
    pattern: "acceptall",
    desc: "Accepts all pending group join requests",
    category: "group",
    react: "✅",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        if (!isGroup) return reply("❌ This command is for groups only.");
        if (!isAdmins) return reply("❌ Admin permissions required.");
        if (!isBotAdmins) return reply("❌ I need admin rights to accept requests.");

        const requests = await conn.groupRequestParticipantsList(from);
        if (requests.length === 0) return reply("ℹ️ Nothing to accept.");

        const jids = requests.map(u => u.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, "approve");
        
        await conn.sendMessage(from, { react: { text: '👍', key: m.key } });
        return reply(`✅ *Success:* ${requests.length} members were approved.`);
    } catch (error) {
        console.error("Accept all error:", error);
        return reply("❌ Failed to process approvals.");
    }
});

// 3. REJECT ALL
cmd({
    pattern: "rejectall",
    desc: "Rejects all pending group join requests",
    category: "group",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        if (!isGroup) return reply("❌ This command is for groups only.");
        if (!isAdmins) return reply("❌ Admin permissions required.");
        if (!isBotAdmins) return reply("❌ I need admin rights to reject requests.");

        const requests = await conn.groupRequestParticipantsList(from);
        if (requests.length === 0) return reply("ℹ️ Nothing to reject.");

        const jids = requests.map(u => u.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, "reject");
        
        await conn.sendMessage(from, { react: { text: '👎', key: m.key } });
        return reply(`✅ *Success:* ${requests.length} requests were declined.`);
    } catch (error) {
        console.error("Reject all error:", error);
        return reply("❌ Failed to process rejections.");
    }
});
