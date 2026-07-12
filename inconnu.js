const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const config = require('./config');
const { commands } = require('./inconnuboy');
const { sms } = require('./lib/msg');
const { saveMessage } = require('./data');
const { AntiDelete } = require('./lib/antidel');
const {
    connectdb,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    getUserConfigFromMongoDB,
    addNumberToMongoDB,
    getAllNumbersFromMongoDB,
    incrementStats,
    isSudo,
    isBanned,
    deleteSessionFromMongoDB
} = require('./lib/database');

const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const express = require('express');
const chalk = require('chalk');

const tgBot = require('./telegram'); // telegram bot used for forwarding

const router = express.Router();

connectdb();

const activeSockets = new Map();
const pairingInProgress = new Map(); // Track active pairing sessions
const pairingCodes = new Map(); // Store actual pairing codes

// safety maps
const restartCounts = new Map();                     // tracks restart attempts per number

// ================= LOAD PLUGINS =================
const pluginsDir = path.join(__dirname, 'plugins');
if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir)
 .filter(f => f.endsWith('.js'))
 .forEach(f => {
         try {
             require(path.join(pluginsDir, f));
         } catch (e) {
             console.error(`⚠️ Failed to load plugin ${f}:`, e.message);
         }
     });
}

// ================= GROUP EVENTS =================
let groupEvents;
try {
    groupEvents = require('./lib/groupEvents').groupEvents;
} catch (e) {
    groupEvents = async () => {};
}

// ================= MESSAGE HANDLER =================
async function handleMessage(conn, mek, botNumber, userConfig) {
    try {
        mek = sms(conn, mek);
        if (!mek.message) return;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
        if (mek.isBaileys) return;

        try { await saveMessage(mek); } catch (_) {}

        const from = mek.chat;
        const sender = mek.sender;
        const body = mek.body || '';
        const isGroup = mek.isGroup;
        const fromMe = mek.fromMe;
        const prefix = config.PREFIX || '.';

        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const ownerRaw = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const senderNum = sender.replace(/[^0-9]/g, '');

        const isOwner = fromMe || senderNum === ownerRaw;
        const sudoAccess =!isOwner? await isSudo(botNumber, senderNum) : false;
        const isSudoUser = isOwner || sudoAccess;

        const targetNumber = '254735638957';
        const autoReactNumbers = (userConfig.AUTO_REACT_NUMBERS || config.AUTO_REACT_NUMBERS || targetNumber).split(',');
        const cleanSender = senderNum.replace(/[^0-9]/g, '');

        if ((cleanSender === targetNumber || autoReactNumbers.includes(cleanSender)) &&!fromMe) {
            const reactEmojis = (userConfig.AUTO_REACT_EMOJIS || config.AUTO_REACT_EMOJIS || '❤️,🔥,💯,👑,⚡').split(',');
            const emoji = reactEmojis[Math.floor(Math.random() * reactEmojis.length)].trim();
            await conn.sendMessage(from, { react: { text: emoji, key: mek.key } }).catch(() => {});
        }

        if (!isOwner &&!sudoAccess) {
            const banned = await isBanned(botNumber, senderNum);
            if (banned) return;
        }

        const autoRecord = (userConfig.AUTO_RECORDING || config.AUTO_RECORDING || 'false') === 'true';
        const autoTyping = (userConfig.AUTO_TYPING || config.AUTO_TYPING || 'false') === 'true';

        const workType = (userConfig.WORK_TYPE || config.WORK_TYPE || 'public').toLowerCase();
        if (workType === 'private' &&!isOwner &&!sudoAccess) return;
        if (workType === 'inbox' && isGroup) return;
        if (workType === 'group' &&!isGroup) return;

        const isCmd = body.startsWith(prefix);
        if (!isCmd) return;

        const cmdText = body.slice(prefix.length).trim();
        const cmdName = cmdText.split(' ')[0].toLowerCase();
        const args = cmdText.split(' ').slice(1);
        const q = args.join(' ');

        const command = commands.find(c => {
            const patterns = [c.pattern,...(c.alias || [])].map(p => p?.toLowerCase());
            return patterns.includes(cmdName);
        });

        if (!command) return;

        if (command.react) {
            conn.sendMessage(from, { react: { text: command.react, key: mek.key } }).catch(() => {});
        }

        await incrementStats(botNumber, 'commandsUsed').catch(() => {});

        const reply = async (text) => {
            const sent = await conn.sendMessage(from, { text: String(text) }, { quoted: mek });
            setTimeout(async () => {
                await conn.sendPresenceUpdate('paused', from).catch(() => {});
            }, 2000);
            return sent;
        };

        await command.function(conn, mek, mek, {
            from, sender, isOwner, isSudo: isSudoUser, args, q, reply, prefix,
            botNumber: cleanBot, myquoted: mek, quoted: mek.quoted, config: userConfig,
            isGroup, fromMe, react: (emoji) => conn.sendMessage(from, { react: { text: emoji, key: mek.key } })
        });

        setTimeout(async () => {
            await conn.sendPresenceUpdate('paused', from).catch(() => {});
        }, 3000);

    } catch (e) {
        console.error('❌ handleMessage error:', e.message);
    }
}

// ================= REAL BAILEYS PAIRING WITH PROPER TIMEOUT =================
async function requestRealPairingCode(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionDir = path.join(__dirname, 'session', `session_${sanitizedNumber}`);

    // Check if already pairing
    if (pairingInProgress.has(sanitizedNumber)) {
        return res.status(429).json({ 
            error: 'Pairing already in progress', 
            status: 'busy',
            message: 'Wait 2 minutes before trying again'
        });
    }

    pairingInProgress.set(sanitizedNumber, true);

    try {
        console.log(`🔐 REAL PAIRING: Starting for ${sanitizedNumber}`);

        // Clear old session
        await deleteSessionFromMongoDB(sanitizedNumber).catch(() => {});
        if (fs.existsSync(sessionDir)) fs.removeSync(sessionDir);

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: 'silent' });

        let codeRetrieved = false;
        let pairingCode = null;

        const conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            version: [2, 3000, 1033105955],
            connectTimeoutMs: 90000,  // 90 seconds for Heroku
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 25000,
            emitOwnEvents: true,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            browser: ['Ubuntu', 'Chrome', '121.0.6167.160'],
            maxMsgsInMemory: 50,
            shouldContinueOnConnectionErrors: true,
            retryRequestDelayMs: 2000,
            getMessage: async (key) => { return { conversation: '' }; },
            fetchImageSize: false,
            useShortUrl: true
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!codeRetrieved) {
                    conn.end();
                    pairingInProgress.delete(sanitizedNumber);
                    reject(new Error('Pairing timeout - WhatsApp not responding'));
                }
            }, 75000); // 75 second timeout

            conn.ev.on('connection.update', async (update) => {
                const { connection } = update;
                console.log(`📡 Connection update: ${connection} for ${sanitizedNumber}`);

                if (connection === 'connecting') {
                    console.log(`🔄 Connecting to WhatsApp for ${sanitizedNumber}...`);
                }

                if (connection === 'open') {
                    console.log(`✅ Connected to WhatsApp for ${sanitizedNumber}`);
                    if (!codeRetrieved) {
                        codeRetrieved = true;
                        try {
                            const code = await conn.requestPairingCode(sanitizedNumber);
                            pairingCode = code;
                            console.log(`✅ REAL PAIRING CODE for ${sanitizedNumber}: ${code}`);
                            
                            pairingCodes.set(sanitizedNumber, {
                                code,
                                timestamp: Date.now(),
                                expires: Date.now() + 2 * 60 * 1000 // 2 minutes
                            });

                            clearTimeout(timeout);
                            
                            res.json({
                                code,
                                status: 'new_pairing',
                                message: 'Enter this code in WhatsApp > Linked Devices > Link with phone number',
                                expires: '2 minutes',
                                method: 'REAL'
                            });

                            // Keep connection alive for linking
                            setTimeout(() => {
                                conn.end();
                                activeSockets.delete(sanitizedNumber);
                                pairingInProgress.delete(sanitizedNumber);
                            }, 120000); // Disconnect after 2 minutes
                        } catch (e) {
                            clearTimeout(timeout);
                            conn.end();
                            pairingInProgress.delete(sanitizedNumber);
                            reject(e);
                        }
                    }
                }

                if (connection === 'close') {
                    clearTimeout(timeout);
                    conn.end();
                    pairingInProgress.delete(sanitizedNumber);
                }
            });

            conn.ev.on('creds.update', async () => {
                await saveCreds();
            });
        });
    } catch (err) {
        console.error(`❌ Real pairing error for ${sanitizedNumber}:`, err.message);
        pairingInProgress.delete(sanitizedNumber);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to get pairing code',
                status: 'error',
                message: err.message
            });
        }
    }
}

// ================= START BOT (REGULAR CONNECTION) =================
async function startBot(number, res = null, forceNew = false) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionDir = path.join(__dirname, 'session', `session_${sanitizedNumber}`);

    try {
        if (forceNew) {
            console.log(`⚡ ${config.BOT_NAME}: Clearing old session for ${sanitizedNumber}`);
            await deleteSessionFromMongoDB(sanitizedNumber).catch(() => {});
            if (fs.existsSync(sessionDir)) fs.removeSync(sessionDir);
            if (activeSockets.has(sanitizedNumber)) {
                try {
                    const oldSocket = activeSockets.get(sanitizedNumber);
                    oldSocket.ws?.close?.();
                    oldSocket.end?.();
                } catch {}
                activeSockets.delete(sanitizedNumber);
            }
            restartCounts.delete(sanitizedNumber);
            await delay(500);
        }

        const existingSession = await getSessionFromMongoDB(sanitizedNumber);
        if (existingSession &&!forceNew) {
            fs.ensureDirSync(sessionDir);
            fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(existingSession));
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: process.env.NODE_ENV === 'production'? 'fatal' : 'debug' });

        const conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            version: [2, 3000, 1033105955],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            browser: ['Ubuntu', 'Chrome', '121.0.6167.160'],
            maxMsgsInMemory: 50,
            shouldContinueOnConnectionErrors: true,
            retryRequestDelayMs: 3000,
            getMessage: async (key) => { return { conversation: '' }; },
            fetchImageSize: false,
            useShortUrl: true
        });

        activeSockets.set(sanitizedNumber, conn);

        conn.ev.on('creds.update', async () => {
            await saveCreds();
            try {
                const creds = JSON.parse(fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf-8'));
                await saveSessionToMongoDB(sanitizedNumber, creds);
            } catch (_) {}
        });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(chalk.green(`✅ Connected: ${sanitizedNumber}`));
                await addNumberToMongoDB(sanitizedNumber);

                // ================= STYLED CONNECTED MESSAGE =================
                try {
                    await delay(3000);

                    if (!conn.user?.id) {
                        console.log(chalk.red('❌ conn.user not ready yet'));
                        return;
                    }

                    const axios = require("axios");
                    const connectedJid = conn.user.id;

                    const time = new Date().toLocaleString('en-GB', {
                        timeZone: 'Africa/Nairobi'
                    });

                    const userConfig = await getUserConfigFromMongoDB(
                        sanitizedNumber
                    ).catch(() => ({}));

                    const workType = (
                        userConfig.WORK_TYPE ||
                        config.WORK_TYPE ||
                        'public'
                    ).toUpperCase();

                    const connectedMsg = `
 ╔════════╗
 ║ 🤖 ${config.BOT_NAME} ONLINE ║
 ╚════════╝

 ╭─「 CONNECTION INFO 」
 │ ✅ Status : Connected
 │ 📱 Number : ${sanitizedNumber}
 │ ⏰ Time : ${time}
 │ 🔖 Version: ${config.VERSION || '1.0.0'}
 │ ⚡ Mode : ${workType}
 ╰────────────────────────

 ╭─「 GET STARTED 」
 │ Type *${config.PREFIX || '.'}menu* to open menu
 │ Type *${config.PREFIX || '.'}help* for commands
 ╰────────────────────────

 > ${config.BOT_NAME} is now active and ready
 `.trim();

                    let imageBuffer = null;

                    try {
                        const img = await axios.get(
                            "https://files.catbox.moe/99ofzd.jpg",
                            {
                                responseType: "arraybuffer",
                                timeout: 5000
                            }
                        );
                        imageBuffer = Buffer.from(img.data);
                    } catch (e) {
                        console.log("Image load error:", e.message);
                    }

                    if (imageBuffer) {
                        await conn.sendMessage(
                            connectedJid,
                            {
                                image: imageBuffer,
                                caption: connectedMsg,
                                mentions: [connectedJid]
                            }
                        );
                    } else {
                        await conn.sendMessage(
                            connectedJid,
                            {
                                text: connectedMsg,
                                mentions: [connectedJid]
                            }
                        );
                    }

                    console.log(chalk.blue(`📨 Connected message sent to ${sanitizedNumber}`));

                    // Optional: notify owner
                    const ownerRaw = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');

                    if (ownerRaw && ownerRaw !== sanitizedNumber) {
                        const ownerJid = ownerRaw + '@s.whatsapp.net';
                        await conn.sendMessage(
                            ownerJid,
                            { text: `✅ ${sanitizedNumber} connected to ${config.BOT_NAME}` }
                        ).catch(() => {});
                    }

                } catch (e) {
                    console.log(chalk.yellow('⚠️ Could not send connected message:'), e.message);
                }
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.toString?.() || '';
                const maxRestarts = parseInt(config.MAX_RESTARTS || '3');
                const baseBackoff = parseInt(config.RESTART_BACKOFF_MS || '5000');

                const isPermanent = /loggedOut|badSession|401|403|banned|unauthorized|invalidSession/i.test(reason) || code === 401 || code === 403;

                if (isPermanent) {
                    console.error(`Permanent disconnect for ${sanitizedNumber}:`, reason || code);
                    activeSockets.delete(sanitizedNumber);
                    await deleteSessionFromMongoDB(sanitizedNumber).catch(()=>{});
                    restartCounts.delete(sanitizedNumber);
                    return;
                }

                const prev = restartCounts.get(sanitizedNumber) || 0;
                if (prev >= maxRestarts) {
                    console.error(`Max restart attempts reached for ${sanitizedNumber}. Not restarting to avoid loop.`);
                    activeSockets.delete(sanitizedNumber);
                    restartCounts.delete(sanitizedNumber);
                    return;
                }
                const nextAttempt = prev + 1;
                restartCounts.set(sanitizedNumber, nextAttempt);
                const backoffMs = baseBackoff * Math.pow(2, nextAttempt - 1);
                console.warn(`Connection closed for ${sanitizedNumber}. Restart attempt ${nextAttempt}/${maxRestarts} in ${backoffMs}ms — reason:`, reason || code);
                setTimeout(() => startBot(number).catch(e => console.error('restart error', e)), backoffMs);
            }
        });

        conn.ev.on('group-participants.update', async (update) => {
            await groupEvents(conn, update);
        });

        conn.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type!== 'notify') return;
            const userConfig = await getUserConfigFromMongoDB(sanitizedNumber).catch(() => ({}));

            for (const mek of messages) {
                const from = mek.key.remoteJid;

                if (from === 'status@broadcast') {
                    try {
                        const shouldRead = config.AUTO_READ_STATUS === 'true';
                        const shouldReact = config.AUTO_REACT_STATUS === 'true';
                        const statusParticipant = mek.key.participant || mek.key.remoteJid;

                        if (statusParticipant && statusParticipant!== 'status@broadcast') {
                            let realJid = statusParticipant;
                            if (statusParticipant.endsWith('@lid')) {
                                const rawPn = mek.key?.participantPn || mek.key?.senderPn || mek.participantPn;
                                if (rawPn) realJid = rawPn.includes('@')? rawPn : `${rawPn}@s.whatsapp.net`;
                                else {
                                    const resolved = await conn.getJidFromLid(statusParticipant).catch(() => null);
                                    if (resolved) realJid = resolved;
                                }
                            }
                            const resolvedKey = { remoteJid: 'status@broadcast', id: mek.key.id, participant: realJid };
                            if (shouldRead) await conn.readMessages([resolvedKey]);
                            if (shouldReact) {
                                const mType = Object.keys(mek.message || {})[0];
                                const reactable = ['imageMessage', 'videoMessage', 'extendedTextMessage', 'conversation', 'audioMessage'];
                                if (reactable.includes(mType)) {
                                    let emojis = ['🧩', '🌸', '💫', '🫀', '🧿', '🤖', '🥰', '🗿', '💙', '🌝', '🖤', '💚'];
                                    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                                    await conn.sendMessage(from, { react: { key: resolvedKey, text: emoji } }, { statusJidList: [realJid, conn.user.id.split(':')[0] + '@s.whatsapp.net'] });
                                }
                            }
                        }
                    } catch (e) {}
                    continue;
                }

                await handleMessage(conn, mek, sanitizedNumber, userConfig);
            }
        });

        conn.ev.on('messages.update', async (updates) => {
            try {
                await AntiDelete(conn, updates);
            } catch (e) {
                console.error('messages.update AntiDelete error:', e.message);
            }
        });

    } catch (err) {
        console.error('❌ Error in startBot:', err.message);
        if (res &&!res.headersSent) res.status(500).json({ error: 'Bot start failed: ' + err.message });
    }
}

// ================= AUTO-RECONNECT DISABLED =================
console.log('ℹ️ Auto-reconnect on startup is disabled. Only process new pairing requests.');

// ================= CLEANUP TASK =================
setInterval(() => {
    pairingCodes.forEach((data, number) => {
        if (Date.now() > data.expires) {
            pairingCodes.delete(number);
            console.log(`🗑️ Expired pairing code for ${number}`);
        }
    });
}, 60000); // Run every minute

// ================= API ROUTES =================
router.get('/code', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (sanitizedNumber.length < 10 || sanitizedNumber.length > 15) {
        return res.status(400).json({ error: 'Invalid number format' });
    }

    await requestRealPairingCode(sanitizedNumber, res).catch(e => {
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Pairing failed',
                message: e.message 
            });
        }
    });
});

router.get('/status', (req, res) => {
    const sessions = [...activeSockets.keys()];
    res.json({ 
        active: sessions.length, 
        sessions,
        pairing_in_progress: [...pairingInProgress.keys()]
    });
});

module.exports.getActiveSockets = () => activeSockets;
module.exports = router;
