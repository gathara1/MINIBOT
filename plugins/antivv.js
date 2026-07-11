const { cmd } = require('../inconnuboy');
const { getContentType } = require('@whiskeysockets/baileys');

global.ANTI_VIEWONCE = true;


// COMMAND CONTROL

cmd({
    pattern: "antiviewonce",
    desc: "Enable or Disable Anti ViewOnce",
    category: "settings",
    filename: __filename
}, async (conn, m, mek, { args, reply }) => {

    if (!args[0]) {

        return reply(`👁️ *ANTI VIEWONCE SETTINGS*

Status: ${global.ANTI_VIEWONCE ? "✅ ON" : "❌ OFF"}

Usage:
.antiviewonce on
.antiviewonce off`);

    }

    const option = args[0].toLowerCase();

    if (option === "on") {

        global.ANTI_VIEWONCE = true;
        return reply("✅ Anti ViewOnce Enabled");

    }

    if (option === "off") {

        global.ANTI_VIEWONCE = false;
        return reply("❌ Anti ViewOnce Disabled");

    }

});


// AUTO RESTORE (WORKS AUTOMATICALLY)

cmd({
    on: "body"
},
async (conn, m, mek, { from }) => {

    try {

        if (!global.ANTI_VIEWONCE) return;

        if (!mek.message) return;

        const type = getContentType(mek.message);

        if (type !== "viewOnceMessageV2" && type !== "viewOnceMessage")
            return;

        const viewOnce = mek.message[type].message;

        const mediaType = getContentType(viewOnce);

        const media = viewOnce[mediaType];

        const sender =
            (mek.key.participant || mek.key.remoteJid);

        if (mediaType === "imageMessage") {

            await conn.sendMessage(from, {

                image: media,
                caption: `👁️ *VIEW ONCE RESTORED*`,
                mentions: [sender]

            }, { quoted: mek });

        }

        else if (mediaType === "videoMessage") {

            await conn.sendMessage(from, {

                video: media,
                caption: `👁️ *VIEW ONCE RESTORED*`,
                mentions: [sender]

            }, { quoted: mek });

        }

        else if (mediaType === "audioMessage") {

            await conn.sendMessage(from, {

                audio: media,
                mimetype: "audio/mp4"

            }, { quoted: mek });

        }

    } catch (err) {

        console.log("AntiViewOnce Error:", err);

    }

});
