/* สิทธิ์รางวัลอยู่ต่อได้เมื่อถอด event/; ไม่อ่านไฟล์หรือสูตรของฤดูกาล */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HalloweenOwnership = factory();
})(typeof globalThis === 'undefined' ? this : globalThis, () => {
  'use strict';
  const VERSION = 1;
  function create(owner, season) {
    if (!owner || !season) throw Error('ต้องระบุเจ้าของและฤดูกาล');
    return {version: VERSION, owner, season, revision: 0, event: null, rewards: {}, receipts: {}, updatedAt: null};
  }
  function validate(value, owner, season) {
    if (!value || value.version !== VERSION || value.owner !== owner || value.season !== season || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.rewards || !value.receipts) throw Error('ข้อมูลห้องลองไม่ตรงเจ้าของหรือรุ่น กรุณาใช้ชุดทดสอบใหม่');
    return value;
  }
  function grant(document, item, receipt, at) {
    if (!item?.id || !receipt) throw Error('ไม่มีหลักฐานรับรางวัล');
    if (!document.rewards[item.id]) document.rewards[item.id] = {id: item.id, receivedAt: at, receipt, permanent: true, restriction: item.restriction || null};
    return document.rewards[item.id];
  }
  function list(document) { return Object.values(document?.rewards || {}).map(x => ({...x})); }
  function createStore({storage, key, owner, season, initial, locks}) {
    if (!storage || !key || !owner || !season) throw Error('ที่เก็บข้อมูลยังไม่พร้อม');
    const read = () => {
      const raw = storage.getItem(key);
      return raw == null ? initial() : validate(JSON.parse(raw), owner, season);
    };
    let queue = Promise.resolve();
    function transact(requestId, update) {
      // คิวเครื่องนี้ + Web Lock ข้ามแท็บ; การเขียนชุดเดียวทำให้สิทธิ์กับยอดไม่แยกกัน
      const run = () => {
        const current = read();
        if (Object.hasOwn(current.receipts, requestId)) return {document: current, result: current.receipts[requestId], replay: true};
        const next = JSON.parse(JSON.stringify(current));
        const result = update(next);
        next.receipts[requestId] = result;
        next.revision = current.revision + 1;
        next.updatedAt = result.at;
        validate(next, owner, season);
        storage.setItem(key, JSON.stringify(next));
        return {document: next, result, replay: false};
      };
      const job = () => locks?.request ? locks.request('studentos-halloween:' + key, run) : run();
      const pending = queue.then(job);
      queue = pending.catch(() => {});
      return pending;
    }
    return Object.freeze({read, transact});
  }
  return Object.freeze({VERSION, create, validate, grant, list, createStore});
});
