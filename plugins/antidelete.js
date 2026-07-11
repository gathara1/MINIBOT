const { cmd } = require("../inconnuboy");
const config = require("../config");

// ================================
// ANTI DELETE EVENT LISTENER
// ================================

cmd({ on: "messages.update" }, async (client, updates) => {
try {
if (!config.ANTI_DELETE) return;

    // Ensure message loader exists
    if (typeof client.loadMessage !== "function") {
        console.log("❌ client.loadMessage is not defined.");
        return;
    }

    // Bot owner's/self inbox JID
    const myJid = client.user.id.split(":")[0] + "@s.whatsapp.net";

    for (const update of updates) {

        if (!update?.update) continue;

        // Support different Baileys structures
        const protocol =
            update.update?.message?.protocolMessage ||
            update.update?.protocolMessage;

        // Detect deleted messages
        if (protocol && protocol.type === 0) {

            const key = protocol.key;
            if (!key) continue;

            console.log("🗑️ Deleted message detected:", key);

            // Load original message
            const originalMsg = await client.loadMessage(
                key.remoteJid,
                key.id
            );

            if (!originalMsg) {
                console.log("❌ Original message not found.");
                continue;
            }

            const sender =
                key.participant ||
                key.remoteJid;

            const caption = `*🚫 ANTI DELETE DETECTED 🚫*

👤 User: @${sender.split("@")[0]}
💬 Chat: ${key.remoteJid}
🕒 Time: ${new Date().toLocaleString()}

Recovered deleted message below`;

            // Send alert to self inbox
            await client.sendMessage(myJid, {
                text: caption,
                mentions: [sender]
            });

            // Forward deleted message to self inbox
            await client.copyNForward(
                myJid,
                originalMsg,
                true
            );

            console.log("✅ Deleted message sent to inbox.");
        }
    }

} catch (err) {
    console.log("AntiDelete Error:", err);
}

});

// ================================
// ANTI DELETE TOGGLE COMMAND
// ================================

cmd({
pattern: "antidelete",
alias: ["nodelete", "atd"],
desc: "Toggle Anti Delete",
category: "owner",
react: "🗑️",
filename: __filename,
fromMe: true
},
async (client, message, m, { args, from }) => {

try {

    const action = args[0]?.toLowerCase();

    if (action === "on") {
        config.ANTI_DELETE = true;

        return await client.sendMessage(from, {
            text: "✅ *Anti Delete Enabled*\nDeleted messages will now be sent to your inbox."
        }, { quoted: message });
    }

    if (action === "off") {
        config.ANTI_DELETE = false;

        return await client.sendMessage(from, {
            text: "❌ *Anti Delete Disabled*"
        }, { quoted: message });
    }

    return await client.sendMessage(from, {
        text: `🗑️ *Anti Delete Status*\n\n${config.ANTI_DELETE ? "✅ Enabled" : "❌ Disabled"}`
    }, { quoted: message });

} catch (e) {
    console.log("Command Error:", e);

    await client.sendMessage(from, {
        text: "⚠️ Error occurred."
    });
}

});