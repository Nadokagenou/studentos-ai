export const __sent = [];
let fail = null;
export function __setFail(f) { fail = f; }
export default {
  setVapidDetails() {},
  async sendNotification(sub, payload) {
    if (fail) { const e = fail(sub); if (e) throw e; }
    __sent.push({ endpoint: sub.endpoint, ...JSON.parse(payload) });
  },
};
