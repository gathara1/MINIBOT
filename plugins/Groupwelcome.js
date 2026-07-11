const { isJidGroup } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const { cmd } = require('../inconnuboy');

// ===== DB SCHEMA =====
const groupSettingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    welcome: { type: Boolean, default: true },
    goodbye: { type: Boolean, default: true },
    adminEvents: { type: Boolean, default: false },
    welcomeMsg: { type: String, default: null },
    goodbyeMsg: { type: String, default: null },
    welcomeImg: { type: String, default: null },
    goodbyeImg: { type: String, default: null }
});

const GroupSettingsDB = mongoose.model('groupsettings', groupSettingsSchema);

const getGroupSettings = async (jid) => {
    let data = await GroupSettingsDB.findOne({ jid });
    if (!data) {
        data = await GroupSettingsDB.create({ jid });
    }
    return data;
};

// ===== EVENT HANDLER =====
const getContextInfo = (m) => ({
    mentionedJid: [m.sender],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421104812135@newsletter',
        newsletterName: 'NAPPIER-XMD',
        serverMessageId: 143,
    },
});

const ppUrls = ['https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png'];

const groupEvents = async (conn, update) => {
    try {
        if (!isJidGroup(update.id)) return;
        if (!['add', 'remove', 'promote', 'demote'].includes(update.action)) return;

        const settings = await getGroupSettings(update.id);
        const metadata = await conn.groupMetadata(update.id);
        const participants = update.participants || [];
        const desc = metadata.desc || "No Description";
        const groupMembersCount = metadata.participants.length;

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(update.id, 'image');
        } catch {
            ppUrl = ppUrls[0];
        }

        for (const num of participants) {
            const userName = num.split("@")[0];
            const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });

            if (update.action === "add" && settings.welcome) {
                const WelcomeText = settings.welcomeMsg ||
                    `Hey @${userName} 👋\n` +
                    `Welcome to *${metadata.subject}*.\n` +
                    `Member #${groupMembersCount}.\n` +
                    `Time: *${timestamp}*\n` +
                    `${desc}\n\n` +
                    `*Powered by NAPPIER-XMD*.`;

                await conn.sendMessage(update.id, {
                    image: { url: settings.welcomeImg || ppUrl },
                    caption: WelcomeText,
                    mentions: [num],
                    contextInfo: getContextInfo({ sender: num }),
                });

            } else if (update.action === "remove" && settings.goodbye) {
                const GoodbyeText = settings.goodbyeMsg ||
                    `Goodbye @${userName}. 😔\n` +
                    `Time left: *${timestamp}*\n` +
                    `Members left: ${groupMembersCount}`;

                await conn.sendMessage(update.id, {
                    image: { url: settings.goodbyeImg || ppUrl },
                    caption: GoodbyeText,
                    mentions: [num],
                    contextInfo: getContextInfo({ sender: num }),
                });

            } else if (update.action === "demote" && settings.adminEvents) {
                const demoter = update.author.split("@")[0];
                await conn.sendMessage(update.id, {
                    text: `*Admin Event*\n@${demoter} demoted @${userName}`,
                    mentions: [update.author, num],
                });

            } else if (update.action === "promote" && settings.adminEvents) {
                const promoter = update.author.split("@")[0];
                await conn.sendMessage(update.id, {
                    text: `*Admin Event*\n@${promoter} promoted @${userName}`,
                    mentions: [update.author, num],
                });
            }
        }
    } catch (err) {
        console.error('Group event error:', err);
    }
};

// ===== COMMANDS =====
cmd({
    pattern: "welcome",
    desc: "Toggle welcome messages for this group",
    category: "group",
    filename: __filename
}, async (conn, m, mek, { from, reply, isGroup, args, isAdmin, isCreator }) => {
    if (!isGroup) return reply("✨ Group only.");
    if (!isAdmin &&!isCreator) return reply("❌ Admin only.");

    if (!args[0]) {
        const s = await getGroupSettings(from);
        return reply(
`*Welcome Settings for this group*

Welcome: *${s.welcome? 'ON' : 'OFF'}*
Goodbye: *${s.goodbye? 'ON' : 'OFF'}*
Admin Events: *${s.adminEvents? 'ON' : 'OFF'}*

Usage:
.welcome on/off
.goodbye on/off
.welcome setwelcome <text>
.welcome setgoodbye <text>`
        );
    }

    const option = args[0].toLowerCase();
    let update = {};

    if (option === "on") update.welcome = true;
    else if (option === "off") update.welcome = false;
    else if (option === "setwelcome") update.welcomeMsg = args.slice(1).join(' ');
    else if (option === "setwelcomeimg" && m.quoted?.image) {
        const imgUrl = await conn.downloadAndSaveMediaMessage(m.quoted);
        update.welcomeImg = imgUrl;
    }
    else return reply("Usage:.welcome on/off | setwelcome <text> | setwelcomeimg <reply image>");

    await GroupSettingsDB.findOneAndUpdate({ jid: from }, update, { upsert: true });
    await conn.sendMessage(from, { react: { text: update.welcome!== undefined? (update.welcome? "✅" : "❌") : "✅", key: mek.key } });
    return reply(`🌟 Welcome messages ${update.welcome!== undefined? (update.welcome? 'enabled' : 'disabled') : 'updated'}`);
});

cmd({
    pattern: "goodbye",
    desc: "Toggle goodbye messages for this group",
    category: "group",
    filename: __filename
}, async (conn, m, mek, { from, reply, isGroup, args, isAdmin, isCreator }) => {
    if (!isGroup) return reply("✨ Group only.");
    if (!isAdmin &&!isCreator) return reply("❌ Admin only.");

    const option = args[0]?.toLowerCase();
    if (!['on', 'off', 'setgoodbye', 'setgoodbyeimg'].includes(option)) {
        return reply("Usage:.goodbye on/off | setgoodbye <text> | setgoodbyeimg <reply image>");
    }

    let update = {};
    if (option === "on") update.goodbye = true;
    if (option === "off") update.goodbye = false;
    if (option === "setgoodbye") update.goodbyeMsg = args.slice(1).join(' ');
    if (option === "setgoodbyeimg" && m.quoted?.image) {
        const imgUrl = await conn.downloadAndSaveMediaMessage(m.quoted);
        update.goodbyeImg = imgUrl;
    }

    await GroupSettingsDB.findOneAndUpdate({ jid: from }, update, { upsert: true });
    await conn.sendMessage(from, { react: { text: update.goodbye!== undefined? (update.goodbye? "👋" : "📴") : "✅", key: mek.key } });
    return reply(`🌟 Goodbye messages ${update.goodbye!== undefined? (update.goodbye? 'enabled' : 'disabled') : 'updated'}`);
});

cmd({
    pattern: "adminevents",
    desc: "Toggle admin promote/demote events for this group",
    category: "group",
    filename: __filename
}, async (conn, m, mek, { from, reply, isGroup, args, isAdmin, isCreator }) => {
    if (!isGroup) return reply("✨ Group only.");
    if (!isAdmin &&!isCreator) return reply("❌ Admin only.");

    const option = args[0]?.toLowerCase();
    if (!['on', 'off'].includes(option)) {
        const s = await getGroupSettings(from);
        return reply(`Admin Events: *${s.adminEvents? 'ON' : 'OFF'}*\nUsage:.adminevents on/off`);
    }

    await GroupSettingsDB.findOneAndUpdate({ jid: from }, { adminEvents: option === 'on' }, { upsert: true });
    await conn.sendMessage(from, { react: { text: option === 'on'? "✅" : "❌", key: mek.key } });
    return reply(`🌟 Admin events ${option.toUpperCase()}`);
});

module.exports = { groupEvents, getGroupSettings, GroupSettingsDB };