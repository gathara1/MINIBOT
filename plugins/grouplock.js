const { cmd } = require('../inconnuboy')

cmd({
    pattern: "lockgc",
    alias: ["lock"],
    react: "🔒",
    desc: "Lock group (admins only can send messages)",
    category: "group",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, reply }) => {
    try {
        if (!isGroup) return reply("❌ Group only command");

        await conn.groupSettingUpdate(from, "announcement")

        reply("🔒 Group locked (admins only can send messages)")
    } catch (e) {
        console.log(e)
        reply("❌ Failed to lock group (make sure bot is admin)")
    }
})
