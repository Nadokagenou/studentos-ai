const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READ = new Set(["overview", "users", "notices", "issues", "audit", "bugs"]);
const WRITE = new Set(["grant", "draft", "publish", "withdraw", "triage", "bug_triage", "report_trash", "report_restore"]);
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "รูปแบบคำขอไม่ถูกต้อง");
  const action = input.action;
  if (action === "session") return { action, payload: {} };
  if (!READ.has(action) && !WRITE.has(action))
    throw new HttpError(400, "ไม่พบคำสั่ง");
  if (action === 'bugs' || action === 'issues') {
    const bucket = input.bucket ?? 'pending';
    if (!['pending', 'resolved', 'trash'].includes(bucket)) throw new HttpError(400, 'ไม่พบหมวดรายงาน');
    return { action, payload: { bucket, offset: Math.max(0, Math.min(100000, Math.floor(Number(input.offset) || 0))) } };
  }
  if (READ.has(action))
    return {
      action,
      payload:
        action === "users" || action === "bugs"
          ? {
              query: String(input.query || "").slice(0, 100),
              offset: Math.max(
                0,
                Math.min(100000, Math.floor(Number(input.offset) || 0)),
              ),
            }
          : {},
    };
  if (!UUID.test(input.request_id || ""))
    throw new HttpError(400, "ต้องมีรหัสรายการ");
  const payload = { request_id: input.request_id };
  if (action === 'report_trash' || action === 'report_restore') {
    if (!['bug', 'content'].includes(input.kind)
      || (input.kind === 'bug' ? !UUID.test(input.id || '') : !Number.isSafeInteger(input.id) || input.id < 1))
      throw new HttpError(400, 'รหัสหรือชนิดรายงานไม่ถูกต้อง');
    Object.assign(payload, { kind: input.kind, id: input.kind === 'bug' ? input.id.toLowerCase() : input.id });
  }
  if (action === "grant") {
    if (
      !UUID.test(input.target || "") ||
      !Number.isInteger(input.amount) ||
      input.amount < 1 ||
      input.amount > 10000 ||
      typeof input.reason !== "string" ||
      input.reason.trim().length < 5 ||
      input.reason.length > 300
    )
      throw new HttpError(400, "ตรวจบัญชี จำนวนโทเคน และเหตุผลอีกครั้ง");
    Object.assign(payload, {
      target: input.target,
      amount: input.amount,
      reason: input.reason.trim(),
    });
  }
  if (action === "draft") {
    if (
      typeof input.title !== "string" ||
      input.title.trim().length < 4 ||
      input.title.length > 60 ||
      typeof input.body !== "string" ||
      !input.body.trim() ||
      input.body.length > 280
    )
      throw new HttpError(
        400,
        "หัวข้อหรือข้อความยาวเกินกำหนด หรือยังกรอกไม่ครบ",
      );
    if (
      input.until != null &&
      (!Number.isFinite(Date.parse(input.until)) ||
        Date.parse(input.until) <= Date.now())
    )
      throw new HttpError(400, "เวลาหมดอายุต้องอยู่ในอนาคต");
    Object.assign(payload, {
      title: input.title.trim(),
      body: input.body.trim(),
      until: input.until || null,
    });
  }
  if (action === "publish" || action === "withdraw") {
    if (!UUID.test(input.id || ""))
      throw new HttpError(400, "รหัสประกาศไม่ถูกต้อง");
    payload.id = input.id;
    if (action === "publish") {
      if (typeof input.push !== "boolean")
        throw new HttpError(400, "ระบุว่าจะส่ง Push หรือไม่");
      payload.push = input.push;
    }
  }
  if (action === "triage") {
    if (
      !Number.isSafeInteger(input.id) ||
      input.id < 1 ||
      !["open", "reviewing", "closed"].includes(input.status)
    )
      throw new HttpError(400, "รหัสหรือสถานะรายงานไม่ถูกต้อง");
    if (
      input.note != null &&
      (typeof input.note !== "string" || input.note.length > 300)
    )
      throw new HttpError(400, "หมายเหตุทีมยาวเกินกำหนด");
    Object.assign(payload, {
      id: input.id,
      status: input.status,
      note: input.note || "",
    });
  }
  if (action === "bug_triage") {
    if (!UUID.test(input.id || "") || !["open", "reviewing", "needs_info", "resolved"].includes(input.status)
      || typeof input.reply !== "string" || input.reply.length > 1500
      || (["needs_info", "resolved"].includes(input.status) && input.reply.trim().length < 5))
      throw new HttpError(400, "ตรวจสถานะและข้อความถึงผู้รายงานอีกครั้ง");
    Object.assign(payload, { id: input.id, status: input.status, reply: input.reply.trim() });
  }
  return { action, payload };
}

export async function authorize({
  authorization,
  githubToken,
  getUser,
  github,
  repository,
}) {
  if (!authorization?.startsWith("Bearer ") || !githubToken)
    throw new HttpError(401, "กรุณาเข้าสู่ระบบด้วย GitHub");
  // getUser verifies the Supabase JWT with the Auth server, never client metadata.
  const user = await getUser(authorization.slice(7));
  if (!user) throw new HttpError(401, "การเข้าสู่ระบบหมดอายุ");
  const identity = user.identities?.find((x) => x.provider === "github");
  if (!identity)
    throw new HttpError(403, "บัญชีนี้ยังไม่ได้ยืนยันตัวตนด้วย GitHub");
  const profile = await github("/user", githubToken);
  const identityId =
    identity.identity_data?.provider_id ?? identity.identity_data?.sub;
  if (!profile.id || String(profile.id) !== String(identityId))
    throw new HttpError(403, "บัญชี GitHub ไม่ตรงกับผู้ที่เข้าสู่ระบบ");
  const repo = await github(`/repos/${repository}`, githubToken);
  if (
    repo.full_name?.toLowerCase() !== repository.toLowerCase() ||
    repo.archived ||
    repo.disabled ||
    !repo.permissions?.push
  )
    throw new HttpError(
      403,
      "เฉพาะผู้ร่วมพัฒนาที่มีสิทธิ์แก้ไขรีโป Student OS เท่านั้น",
    );
  return { id: user.id, login: profile.login };
}

/** @param {{getUser:Function,github:Function,command:Function,afterCommand?:Function,repository?:string,allowedOrigins?:string[]}} options */
export function createHandler({
  getUser,
  github,
  command,
  afterCommand,
  repository = "Nadokagenou/studentos-ai",
  allowedOrigins = [],
}) {
  return async (request) => {
    const origin = request.headers.get("origin");
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      vary: "Origin",
    };
    if (origin && allowedOrigins.includes(origin))
      Object.assign(headers, {
        "access-control-allow-origin": origin,
        "access-control-allow-headers":
          "authorization,apikey,content-type,x-github-token",
        "access-control-allow-methods": "POST,OPTIONS",
      });
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.includes(origin))
      return reply(403, { error: "ที่อยู่เว็บนี้ไม่ได้รับอนุญาต" });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { error: "ใช้ POST เท่านั้น" });
    try {
      if (Number(request.headers.get("content-length") || 0) > 16000)
        throw new HttpError(413, "คำขอยาวเกินกำหนด");
      const text = await request.text();
      if (text.length > 16000) throw new HttpError(413, "คำขอยาวเกินกำหนด");
      let input;
      try {
        input = JSON.parse(text);
      } catch {
        throw new HttpError(400, "ข้อมูล JSON ไม่ถูกต้อง");
      }
      const { action, payload } = validate(input);
      const actor = await authorize({
        authorization: request.headers.get("authorization"),
        githubToken: request.headers.get("x-github-token"),
        getUser,
        github,
        repository,
      });
      if (action === "session")
        return reply(200, { login: actor.login, repo: repository });
      const result = await command(actor, action, payload);
      // Only after the database commits and authorization succeeds. A failed
      // wake-up must not turn a successful grant into an apparent failed grant.
      try { afterCommand?.(action, payload, result); }
      catch { console.warn('[staff-notify] dispatch deferred to cron'); }
      return reply(200, result);
    } catch (e) {
      return reply(e.status || 500, {
        error: e.status
          ? e.message
          : "ระบบหลังบ้านทำรายการไม่สำเร็จ กรุณาตรวจการติดตั้งหรือขีดจำกัดรายการ",
      });
    }
  };
}
