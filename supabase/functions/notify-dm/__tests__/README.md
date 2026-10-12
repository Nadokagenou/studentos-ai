# เทสต์ของ notify-dm

รันบน Node ธรรมดา ใช้ของจำลองชุดเดียวกับ send-reminders (เติม `insert` ใน `sb.mjs`)

```bash
cd supabase/functions/notify-dm/__tests__
npx --yes esbuild@0.23.1 --bundle --format=esm "--external:npm:*" "--external:jsr:*" \
  --outfile=fn.mjs ../index.ts
node -e "const fs=require('fs');const s=fs.readFileSync('fn.mjs','utf8');fs.writeFileSync('fn.mjs',s.replace('\"npm:web-push@3.6.7\"','\"./wp.mjs\"').replace('\"jsr:@supabase/supabase-js@2\"','\"./sb.mjs\"'))"
node run.mjs
```
