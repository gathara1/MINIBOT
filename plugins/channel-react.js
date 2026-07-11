const config = require('../config');
const { cmd } = require('../inconnuboy');

cmd({
    pattern: "ch",
    alias: ["chreact", "bomb"],
    react: "🚀",
    desc: "Send a specific number of reactions to a channel message",
    category: "owner",
    use: '.ch <link> <emoji> <number>',
    filename: __filename
},
async (conn, mek, m, { from, q, isCreator, reply, command }) => {
    try {
        // 1. Security Check
        if (!isCreator) return reply("❌ This power is for the Owner only.");

        // 2. Parse the Input (Split by space)
        const args = q.trim().split(/\s+/); 
        if (args.length < 3) {
            return reply(`*Missing Information!*\n\n*Format:* .${command} <link> <emoji> <count>\n*Example:* .${command} https://whatsapp.com/channel/xxx/123 🔥 50`);
        }

        const link = args[0];
        const emoji = args[1];
        const count = parseInt(args[2]);

        // 3. Validation Logic
        if (!link.includes("whatsapp.com/channel/")) return reply("❌ That doesn't look like a valid WhatsApp Channel link.");
        if (isNaN(count) || count <= 0) return reply("❌ Please provide a valid number (e.g., 100).");
        if (count > 500) return reply("⚠️ Safety limit reached. Please keep it under 500 to avoid account bans.");

        // 4. Extract IDs from the Link
        const linkParts = link.split('/');
        const channelId = linkParts[4];
        const messageId = linkParts[5];

        if (!channelId || !messageId) return reply("❌ Link error: Could not find the Channel or Message ID.");

        // 5. Get Channel Metadata (Internal ID)
        const channelMeta = await conn.newsletterMetadata("invite", channelId);
        
        // Let the user know the process has started
        await reply(`🚀 *Starting Reaction Bomb*...\n\nTarget: ${channelMeta.name}\nEmoji: ${emoji}\nAmount: ${count}`);

        // 6. The Execution Loop
        for (let i = 1; i <= count; i++) {
            await conn.newsletterReactMessage(channelMeta.id, messageId, emoji);
            
            // This 300ms pause keeps the bot "under the radar" of WhatsApp's spam filters
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 7. Success Notification
        return reply(`✅ *Finished!*\nSent ${count} "${emoji}" reactions to the message.`);

    } catch (e) {
        console.error(e);
        reply(`❎ *System Error:* ${e.message || "Operation failed."}`);
    }
});
