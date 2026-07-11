const PQueue = require('p-queue');

// single global send queue for rate-limited outgoing messages
const sendQueue = new PQueue({ concurrency: 1, intervalCap: 1, interval: 2000 }); // 1 message every 2s

module.exports.queuedSend = (sock, jid, message, opts = {}) => {
  return sendQueue.add(() => sock.sendMessage(jid, message, opts));
};
