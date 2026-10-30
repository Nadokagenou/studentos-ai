import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createHandler, HttpError } from "./core.mjs";
import { createNotifyKick } from "./notify-kick.mjs";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowedOrigins = (
  Deno.env.get("STAFF_ALLOWED_ORIGINS") || "https://nadokagenou.github.io"
)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
Deno.serve(
  createHandler({
    repository: "Nadokagenou/studentos-ai",
    allowedOrigins,
    afterCommand: createNotifyKick({
      url, key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      waitUntil: (task: Promise<unknown>) => EdgeRuntime.waitUntil(task),
    }),
    getUser: async (token: string) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : data.user;
    },
    github: async (path: string, token: string) => {
      let r;
      try {
        r = await fetch("https://api.github.com" + path, {
          headers: {
            authorization: "Bearer " + token,
            accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new HttpError(
          503,
          "ติดต่อ GitHub เพื่อตรวจสิทธิ์ไม่ได้ กรุณาลองใหม่",
        );
      }
      if (r.status === 401)
        throw new HttpError(401, "สิทธิ์ GitHub หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      if (!r.ok)
        throw new HttpError(
          503,
          "ยังตรวจสิทธิ์ GitHub ไม่สำเร็จ ระบบจึงยังไม่อนุญาตให้จัดการข้อมูล",
        );
      return r.json();
    },
    command: async (
      actor: { id: string; login: string },
      action: string,
      payload: Record<string, unknown>,
    ) => {
      const reportActions = ["bugs", "issues", "triage", "bug_triage", "report_trash", "report_restore"];
      const moderation = ['users','deduct','ban','unban'].includes(action);
      const insights = ['insights', 'people', 'person'].includes(action);
      const sending = ['audience', 'sends', 'send', 'cancel_send'].includes(action);
      const { data, error } = await db.rpc(insights ? 'staff_insights' : sending ? 'staff_send_command' : action === 'push_status' ? 'staff_push_dashboard' : moderation ? 'staff_moderation_command' : reportActions.includes(action) ? "staff_report_command" : "staff_command", {
        p_actor: actor.id,
        p_login: actor.login,
        p_action: action,
        p_payload: payload,
      });
      if (error)
        throw new HttpError(
          400,
          moderation
            ? (action === 'deduct' ? 'หักโทเคนไม่ได้ ตรวจจำนวนและยอดบนคลาวด์อีกครั้ง' : 'ทำรายการบัญชีไม่ได้ ตรวจผู้รับ เหตุผล และระยะเวลา ห้ามแบนบัญชีแอดมินที่กำลังใช้อยู่')
            : action === "send"
            ? "ส่งข่าวไม่ได้ ตรวจกลุ่มผู้รับ (ต้องมีอย่างน้อย 1 คน) เวลาส่ง และเวลาหมดอายุอีกครั้ง"
            : action === "grant"
            ? "เพิ่มโทเคนไม่ได้ ตรวจว่าผู้รับเคยซิงก์ข้อมูล จำนวนถูกต้อง และยอดต่อวันยังไม่เกินกำหนด"
            : "ทำรายการไม่ได้ กรุณาตรวจข้อมูลหรือการติดตั้งฐานข้อมูล",
        );
      return data;
    },
  }),
);
