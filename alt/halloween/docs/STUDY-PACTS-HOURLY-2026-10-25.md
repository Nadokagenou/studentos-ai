# Hourly doors and real-work study pacts · 25 October 2026

This supersedes the free-travel/house-bonus rules in JOURNEY-REVIEW-2026-10-25.md. The owner requested individual biome openings, hourly random changes, more mathematics, and fair, easy, enjoyable rules. Existing game fonts, reward SVGs and NPC portraits are reused.

### 25 ตุลาคม 2569 · ประตูรายชั่วโมงและพันธสัญญางานจริง

- เปลี่ยนจากเปิดฟรีทุกไบโอมเป็นประตูสุ่มรายชั่วโมงที่ใช้ตารางเดียวกัน ทุกชุด 4 ชม. มีครบสี่ไบโอม ไม่มีซ้ำติด และไบโอมเดิมกลับมาภายใน 2–5 ชม. แสดงเวลาเปิดถัดไปและทางเลือกทำงาน/พักสมอง
- ยกเลิกโบนัสบ้าน +50% กลับฐาน Treat 10 / Trick 20 หรือ 0 คงบ้านพัก 4 ชม. เพดาน 300/24 ชม. และของช่วยครบ 30 เคาะ
- ชุดเริ่มต้นเปิดทาง Tang ส่วนตัว 15 นาทีครั้งเดียว Totem 20 Candy และน้ำยาสุ่ม 10 Candy เปิดทาง 15 นาที ไม่รีเซ็ตบ้าน ต่อสู้/เกมที่เริ่มแล้วเล่นจบได้แม้ประตูเปลี่ยน
- เพิ่มพันธสัญญาที่ผูกงานจริงจาก studyPlan() โดยไม่สร้างหรือกดจบงานแทน: 5, 8, 10 นาที วันละสามช่วง รับบันทึก NPC 16 หน้าและสูงสุด 10 Candy/ช่วง ใช้เพดานภารกิจ 30/24 ชม. ร่วมเควสมรณะ แม้โควตาเต็มยังรับบันทึกได้
- เพิ่มเกมพักสมอง 6 แบบ คณิตสามแบบสุ่มน้ำหนักมากกว่า ไม่ซ้ำชนิดสองรอบล่าสุด ไม่มีเวลาบังคับ ตอบผิดเห็นวิธีคิดและลองใหม่ เล่นซ้ำไม่ให้ Candy
- บัญชีจริงตรวจงานต้นทางจาก user_state ของผู้ใช้ที่ยืนยันแล้วและตรวจ heartbeat บนบริการบัญชี ห้องลองแยกหลักฐาน/รางวัลออกจากของจริง


## Calculated schedule and economy

The 34-day season has 816 hourly windows, exactly 204 per biome. Shared deterministic shuffled blocks contain each biome once. A constrained next block prevents consecutive repeats and bounds start-to-start return gaps to 2–5 hours (maximum closed time four hours). Refreshing, accounts and client RNG do not reroll it. Clock authority remains on the server. Upcoming eight windows are shown at closed doors and in the journal.

Run node alt/halloween/tools/analyze-hourly.cjs to reproduce. A Treat-only simulation visiting every ten minutes hit the first 300-Candy cap after five hours; visiting at 07:00, 16:00 and 20:00 Bangkok earned 150 on the first day. These are scripted schedules, not measured player behavior or promises. Drop weights, the rolling 24-hour cap, per-biome house cooldown and aid rule remain unchanged. Across 20,000 seeded game draws, math/balance/number-pattern made up 60.775%. Every type excludes the previous two; this is variety, not a reward lottery.

## Main application integration

study-pact.js is a permanent pure contract module. study-pact-main.js reads the one existing studyPlan(state, now).now.task and adds one card to the Tasks screen, never the main home screen. It starts the existing focus view on that task; no artificial work, task completion, planner rewrite or title upload is introduced. New preview evidence has an owner-isolated key; existing studentos.alt.* keys stay intact. Explicit preview intent survives the main app query cleanup in sessionStorage. Live enrollment reads only the authenticated account task array through the event service and persists only task ID plus proof, with no task titles in the event save. Completion means verified focus time on the bound real task, not completing the entire homework.

Daily lengths are 5/8/10 minutes, with three different NPCs per day, one active pact, and 16 finite story pages. Rebinding an unfinished contract resets its proof and retains its daily slot. Claims are idempotent by day and slot, and ordinary receipts protect lost responses. Study and death focus leases cannot count the same interval simultaneously. Each pact gives up to ten Candy inside the existing shared 30/rolling-24h task cap, while a valid story claim still succeeds when the Candy cap is full. Free games never grant currency, relics, boss progress, story credit or normal task completion.

## Validation

Browser QA used a fresh localhost origin. Created a normal mathematics homework through the real main-app form, confirmed the pact card recommended the same work as the planner, ran the real visible focus timer beyond five minutes, paused normally, and claimed Dech page 1 plus ten preview Candy. The homework remained incomplete with five recorded work minutes and roughly 35 minutes remaining. This is a real five-minute preview test, not an accelerated fixture. Production signed-in/two-device focus remains untested before the season opens.

Automated regressions cover unknown/deleted/completed/artificial tasks, owner changes, overlapping and accelerated pulses, one-time claims, cap-full stories, API task lookup and receipt replay, all six puzzle solutions, distinct numeric choices, math frequency, and the entire season timetable. Prior complete four-NPC reward, ownership, battle, sync and account suites remain required.

No schema migration or new external service is used. Keep JWT verification on for halloween-event. Main app version remains 1C60; only its cache suffix changes to deliver the new adapters. The legacy 20-minute quest remains optional and shares the same task Candy cap.

Release validation: 178/178 Halloween tests, 36/36 sync checks, 33/33 account checks and 6/6 service-worker checks passed. A runtime-only RED check removed the new study-claim branch: the reward regression failed with an unknown-action error, then all five service tests passed with the real branch restored. No working source was removed for this check. Manual mobile QA completed all six new game types, including random-next session changes, at 375px and checked numeric/path layouts at 320px. Screenshots: brain-math-mobile-2026-10-25.png and hourly-doors-mobile-2026-10-25.png.

The account function halloween-event version 4 deployed ACTIVE with JWT verification enabled. Retrieved deployment files exactly matched all three release inputs. A real unauthenticated POST returned 401 and an allowed-origin OPTIONS returned 204. No production reward was granted by these checks. Date gates and the remaining signed-in/two-device opening-day check still apply.
