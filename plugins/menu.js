// Updated menu.js (document-style menu with newsletter forwarding)
// Replace your existing menu.js with this file and adjust menu content as needed.

const { cmd } = require('../inconnuboy');
const config = require('../config');
const axios = require('axios');

cmd({
  pattern: "menu",
  alias: ["help", "m", "list", "commands"],
  react: "⚡",
  category: "menu",
  desc: "Show full bot command list",
  filename: __filename
}, async (conn, mek, m, { from, prefix }) => {
  try {
    const sender = m.sender;

    const menuMsg = `┏━━❐✧ ${config.BOT_NAME || 'NAPPIER-XMD'} ✧❐
┃✦ User: @${sender.split('@')[0]}
┃✦ Prefix: [${prefix}]
┃✦ Mode: ${config.WORK_TYPE || 'PUBLIC'}
┃✦ Uptime: ${uptimeStr}
┃✦ Speed: ${speed}ms
┗❐${readmore}

┏━━❐ \`OWNER\` ❐
┃ ✧ setprefix
┃ ✧ mode
┃ ✧ autorecording
┃ ✧ autotyping
┃ ✧ autoread
┃ ✧ autostatusview
┃ ✧ anticall
┃ ✧ antidelete
┃ ✧ broadcast
┗❐

┏━━❐ \`GROUP\` ❐
┃ ✧ tagall
┃ ✧ kick
┃ ✧ add
┃ ✧ promote
┃ ✧ demote
┃ ✧ mute
┃ ✧ unmute
┃ ✧ delete
┃ ✧ antilink
┃ ✧ antitag
┃ ✧ lockgc
┗❐

┏━━❐ \`DOWNLOAD\` ❐
┃ ✧ play
┃ ✧ video
┃ ✧ tiktok
┃ ✧ fb
┃ ✧ ig
┃ ✧ app
┃ ✧ movie
┃ ✧ gitclone
┗❐

┏━━❐ \`AI\` ❐
┃ ✧ gpt
┃ ✧ imagine
┃ ✧ gemini
┃ ✧ ai
┃ ✧ deepseek
┃ ✧ metaai
┗❐

┏━━❐ \`TOOLS\` ❐
┃ ✧ ping
┃ ✧ trt
┃ ✧ attp
┃ ✧ ss
┃ ✧ tts
┃ ✧ img
┃ ✧ tomp3
┃ ✧ tourl
┃ ✧ weather
┃ ✧ vv
┃ ✧ caption
┗❐

┏━━❐ \`FUN\` ❐
┃ ✧ hug
┃ ✧ kiss
┃ ✧ slap
┃ ✧ poke
┃ ✧ insult
┃ ✧ hack
┃ ✧ dance
┃ ✧ cry
┗❐

┏━━❐ \`LOGO\` ❐
┃ ✧ neon
┃ ✧ glitch
┃ ✧ galaxy
┃ ✧ marvel
┃ ✧ naruto
┃ ✧ blackpink
┃ ✧ dragonball
┗❐

┏━━❐ \`SETTINGS\` ❐
┃ ✧ always-online
┃ ✧ autoreact
┃ ✧ dashboard
┃ ✧ readreceipt
┃ ✧ setprefix1
┗❐

┏━━❐ \`SEARCH\` ❐
┃ ✧ define
┃ ✧ yts
┃ ✧ shazam
┃ ✧ ytstalk
┗❐

┏━━❐ \`MAIN\` ❐
┃ ✧ alive
┃ ✧ menu
┃ ✧ owner
┃ ✧ repo
┃ ✧ speed
┃ ✧ uptime
┗❐

_⚡ Powered by ${config.BOT_NAME || 'NAPPIER-XMD'}_`;

    const thumb = (await axios.get(
      "https://files.catbox.moe/99ofzd.jpg",
      { responseType: "arraybuffer" }
    )).data;

    await conn.sendMessage(
      from,
      {
        document: Buffer.from("NAPPIER-XMD"),
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: `${config.BOT_NAME || "NAPPIER-XMD"} MENU`,
        fileLength: 999999999,
        pageCount: 999,
        jpegThumbnail: thumb,
        caption: menuMsg,
        mentions: [sender],
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363421104812135@newsletter",
            newsletterName: "NAPPIER-XMD OFFICIAL",
            serverMessageId: 1
          }
        }
      },
      { quoted: mek }
    );

  } catch (err) {
    console.log(err);
  }
});