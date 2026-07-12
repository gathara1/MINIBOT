const { cmd } = require('../inconnuboy');
const { setAnti, getAnti } = require('../data/antidel');

cmd({
    pattern: "antidelete",
    alias: ["antidel", "nodelete"],
    desc: "Turn anti-delete on/off",
    category: "owner",
    react: "🛡️",
    use: ".antidelete on/off",
    filename: __filename
},
async (conn, mek, m, { from, args, isOwner, reply }) => {

    if (!isOwner)
        return reply("*❌ This command is for owner only*");

    const mode = args[0]?.trim().toLowerCase();

    switch (mode) {

        case "on":
        case "enable":
            await setAnti(from, true);
            return reply(
                "*✅ Anti-delete activated*\n" +
                "_Deleted messages will be recovered_"
            );

        case "off":
        case "disable":
            await setAnti(from, false);
            return reply("*❌ Anti-delete deactivated*");

        default:
            const current = await getAnti(from);

            return reply(
                `*🛡️ ANTI-DELETE*\n\n` +
                `*Usage:*\n` +
                `.antidelete on\n` +
                `.antidelete off\n\n` +
                `*Current Status:* ${current ? "ON ✅" : "OFF ❌"}\n\n` +
                `*⚡ NAPPIER-XMD*`
            );
    }
});
