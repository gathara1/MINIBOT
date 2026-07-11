const { cmd } = require('../inconnuboy');
const config = require('../config');
const crypto = require('crypto');

cmd({
  pattern: "pair",
  alias: ["bot", "freebot", "nappierxmd", "pairme"],
  react: "🔗",
  category: "main",
  desc: "Pair your number and get pairing code",
  filename: __filename
}, async (conn, mek, m, { from, prefix }) => {
  try {
    let number = m.sender.split('@')[0];

    if (!from.endsWith('@s.whatsapp.net')) {
      return await conn.sendMessage(from, {
        text: `*❌ Use this command in private chat only*\n\nMessage me directly: wa.me/${conn.user.id.split(':')[0]}`
      }, { quoted: mek });
    }

    await conn.sendMessage(from, {
      text: `🔗 *Generating Pairing Code*\n\nPlease wait 5-10 seconds...`
    }, { quoted: mek });

    let code = await conn.requestPairingCode(number);
    let formattedCode = code.match(/.{1,4}/g).join('-');

    // Store for web page
    let id = crypto.randomBytes(3).toString('hex');
    global.pairCodes = global.pairCodes || new Map();
    global.pairCodes.set(id, code);
    setTimeout(() => global.pairCodes.delete(id), 120000);

    let link = `https://nappiero-fbf4880816e4.herokuapp.com/code/${id}`;

    // List message - works on both WhatsApp & WhatsApp Business
    await conn.sendMessage(from, {
      text: `✅ *Pairing Code Ready*\n\n` +
            `*Code:* \`${formattedCode}\`\n\n` +
            `📱 Open WhatsApp > Linked Devices > Link with phone number instead\n` +
            `⏰ Code expires in 60 seconds.`,
      footer: "NAPPIER-XMD Pair System",
      title: "Choose an Option",
      buttonText: "View Options",
      sections: [
        {
          title: "Pairing Options",
          rows: [
            {
              title: "🌐 Open Link",
              description: "Open the pairing page in browser",
              rowId: "openlink"
            },
            {
              title: "📋 Copy Code",
              description: "Resend the 8-digit code",
              rowId: "copycode"
            }
          ]
        }
      ]
    }, { quoted: mek });

    // Handle list selection
    conn.ev.on('messages.upsert', async (msg) => {
      const message = msg.messages[0];
      if (!message.message?.listResponseMessage) return;

      const rowId = message.message.listResponseMessage.singleSelectReply.selectedRowId;
      const sender = message.key.remoteJid;

      if (rowId === 'openlink') {
        await conn.sendMessage(sender, { text: link });
      }
      if (rowId === 'copycode') {
        await conn.sendMessage(sender, { text: `Here's your code again:\n\`\`${formattedCode}\`\`` });
      }
    });

  } catch (err) {
    console.log("PAIR ERROR:", err);
    await conn.sendMessage(from, {
      text: `*❌ Pairing Failed:* ${err.message}`
    }, { quoted: mek });
  }
});