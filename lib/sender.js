const PQueue = require('p-queue');

// single global send queue for rate-limited outgoing messages
const sendQueue = new PQueue({ concurrency: 1, intervalCap: 1, interval: 2000 }); // 1 task every 2s

module.exports.queuedSend = (sock, jid, message, opts = {}) => {
  return sendQueue.add(() => sock.sendMessage(jid, message, opts));
};

// Add generic task runner to enqueue arbitrary async functions (e.g., newsletterReactMessage)
module.exports.addTask = (fn) => {
  // fn should be an async function returning a promise
  return sendQueue.add(() => fn());
};
