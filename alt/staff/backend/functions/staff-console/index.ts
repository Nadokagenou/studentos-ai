import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createHandler, HttpError } from "./core.mjs";
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
      const { data, error } = await db.rpc("staff_command", {
        p_actor: actor.id,
        p_login: actor.login,
        p_action: action,
        p_payload: payload,
      });
      if (error)
        throw new HttpError(
          400,
          action === "grant"
            ? "เพิ่มโทเคนไม่ได้ ตรวจว่าผู้รับเคยซิงก์ข้อมูล จำนวนถูกต้อง และยอดต่อวันยังไม่เกินกำหนด"
            : "ทำรายการไม่ได้ กรุณาตรวจข้อมูลหรือการติดตั้งฐานข้อมูล",
        );
      return data;
    },
  }),
);
