/** Browser stub — chain.js loadKey/loadParams are unused on Pages. */
module.exports = {
  existsSync() { return false; },
  readFileSync() { throw new Error("fs unavailable in browser"); },
  writeFileSync() { throw new Error("fs unavailable in browser"); },
};
