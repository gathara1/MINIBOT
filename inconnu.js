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
const pairingAttempts = new Map(); // Track pairing attempts

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

        // ⚠️ DISABLED: Auto typing/recording can trigger detection
        // if (autoRecord &&!fromMe) {
        //     await conn.sendPresenceUpdate('recording', from).catch(() => {});
        // } else if (autoTyping &&!fromMe) {
        //     await conn.sendPresenceUpdate('composing', from).catch(() => {});
        // }

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
            // ⚠️ DISABLED: Auto typing/recording can trigger detection
            // if (autoRecord &&!fromMe) {
            //     await conn.sendPresenceUpdate('recording', from).catch(() => {});
            //     await delay(1000);
            // } else if (autoTyping &&!fromMe) {
            //     await conn.sendPresenceUpdate('composing', from).catch(() => {});
            //     await delay(1000);
            // }

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

// ================= WAIT FOR CONNECTION =================
async function waitForConnection(conn, maxWaitTime = 20000) {
    return new Promise((resolve, reject) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                reject(new Error('Connection timeout after ' + maxWaitTime + 'ms'));
            }
        }, maxWaitTime);

        const connectionHandler = (update) => {
            const { connection, qr } = update;
            // Log connection attempts
            if (qr) console.log('📱 QR code detected');
            if (connection === 'connecting') console.log('🔄 Connecting to WhatsApp...');
            
            if (connection === 'open' && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                conn.ev.off('connection.update', connectionHandler);
                resolve(true);
            }
        };

        conn.ev.on('connection.update', connectionHandler);
    });
}

// ================= START BOT =================
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
            restartCounts.delete(sanitizedNumber); // Reset restart counter for fresh pairing
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
            connectTimeoutMs: 120000,
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
            useShortUrl: true,
            qrTimeout: 60000,
            transactionTimeout: 120000
        });

        activeSockets.set(sanitizedNumber, conn);

        if ((!existingSession || forceNew) && res) {
            console.log(`🔐 Starting NEW pairing process for ${sanitizedNumber}`);
            pairingAttempts.set(sanitizedNumber, (pairingAttempts.get(sanitizedNumber) || 0) + 1);
            
            try {
                // WAIT for connection BEFORE requesting pairing code
                console.log(`⏳ Waiting for WhatsApp connection (max 20 seconds)...`);
                await waitForConnection(conn, 20000);
                console.log(`✅ Connection ready, requesting pairing code...`);
                
                // Add small delay to ensure connection is fully initialized
                await delay(2000);
                
                const code = await conn.requestPairingCode(sanitizedNumber);
                console.log(`✅ PAIRING CODE for ${sanitizedNumber}: ${code}`);
                if (!res.headersSent) res.json({
                    code,
                    status: 'new_pairing',
                    message: 'Enter this code in WhatsApp > Linked Devices > Link with phone number',
                    expires: '2 minutes'
                });
            } catch (e) {
                console.error('❌ Pairing code error:', e.message);
                if (!res.headersSent) res.status(500).json({
                    error: 'Failed to get pairing code',
                    status: 'error',
                    message: e.message
                });
                // Clean up on pairing failure
                try {
                    conn.ws?.close?.();
                    conn.end?.();
                } catch {}
                activeSockets.delete(sanitizedNumber);
                throw e;
            }
        } else {
            console.log(`✅ Using existing session for ${sanitizedNumber}`);
        }

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
 ╰─────��──────────────────

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
                        console.log(
                            "Image load error:",
                            e.message
                        );
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

                    console.log(
                        chalk.blue(
                            `📨 Connected message sent to ${sanitizedNumber}`
                        )
                    );

                    // Optional: notify owner
                    const ownerRaw =
                        (config.OWNER_NUMBER || '')
                            .replace(/[^0-9]/g, '');

                    if (
                        ownerRaw &&
                        ownerRaw !== sanitizedNumber
                    ) {
                        const ownerJid =
                            ownerRaw + '@s.whatsapp.net';

                        await conn.sendMessage(
                            ownerJid,
                            {
                                text: `✅ ${sanitizedNumber} connected to ${config.BOT_NAME}`
                            }
                        ).catch(() => {});
                    }

                } catch (e) {
                    console.log(
                        chalk.yellow(
                            '⚠️ Could not send connected message:'
                        ),
                        e.message
                    );
                }
                // ============================================================
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.toString?.() || '';
                const maxRestarts = parseInt(config.MAX_RESTARTS || '3');
                const baseBackoff = parseInt(config.RESTART_BACKOFF_MS || '5000');

                // Permanent/authorization failures — do not restart
                const isPermanent = /loggedOut|badSession|401|403|banned|unauthorized|invalidSession/i.test(reason) || code === 401 || code === 403;

                if (isPermanent) {
                    console.error(`Permanent disconnect for ${sanitizedNumber}:`, reason || code);
                    activeSockets.delete(sanitizedNumber);
                    await deleteSessionFromMongoDB(sanitizedNumber).catch(()=>{});
                    restartCounts.delete(sanitizedNumber);
                    return;
                }

                // transient: use restart counter + exponential backoff
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

                // ⚠️ NEWSLETTER AUTO-REACT REMOVED FOR BAN SAFETY
                // Newsletter reactions are too risky and trigger detection
                // If needed, configure separately in config.js only

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

// ================= AUTO-RECONNECT DISABLED - START FRESH =================
// Auto-reconnect on startup is DISABLED to prevent cascading failures
// Users must manually request pairing codes via the web/Telegram interface
console.log('ℹ️ Auto-reconnect on startup is disabled. Only process new pairing requests.');

// ================= API ROUTES ONLY =================
router.get('/code', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    await startBot(number, res, true);
});

router.get('/status', (req, res) => {
    const sessions = [...activeSockets.keys()];
    res.json({ 
        active: sessions.length, 
        sessions,
        pairing_attempts: Object.fromEntries(pairingAttempts)
    });
});

module.exports.getActiveSockets = () => activeSockets;
module.exports = router;
