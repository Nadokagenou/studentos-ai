"""Promote the requested presentation only; never copy config, server data, or backend sources.
The old sync-to-root.py remains disabled. Run with --apply for this scoped UI update.
"""
from pathlib import Path
import re,json,hashlib,sys,subprocess
R=Path(__file__).resolve().parents[1]; A=R/'alt'
FILES=['app.js','alt.css','today.css','desktop.css','desktop-entry.js','desktop.js','remote-config.js','profile.js','feed.js','hoop.js','room.js','sai.js','quickadd.js','safety.js','events.js','events.css','classrooms.js','classrooms.css','contrast.css','glass.css','compat.js','device-preview-controls.css','hook-hat-avatar.svg','hook-hat-body.svg','hook-hat-face.svg']
PROTECTED=['config.js','manifest.json','integrations.js','linelink.js','brain.js','inbox.js','engine.js','context.js','planner.js','style.css','sync-to-root.py']
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def text(p):return p.read_text(encoding='utf-8').replace('\r\n','\n')
def main():
 apply='--apply' in sys.argv
 protected={n:digest(R/n) for n in PROTECTED}
 protected.update({p.relative_to(R).as_posix():digest(p) for p in (R/'supabase').rglob('*') if p.is_file() and '.temp' not in p.parts})
 writes={}
 for n in FILES:
  if n.endswith(('.png','.svg','.webp')):writes[n]=(A/n).read_bytes();continue
  s=text(A/n)
  if n=='app.js':
   assert 'const ALT_SYSTEM_NOTIFICATIONS = false;' in s
   s=s.replace('const ALT_SYSTEM_NOTIFICATIONS = false;','// The main entry remains the owner of system notifications.\nconst ALT_SYSTEM_NOTIFICATIONS = true;',1)
   # Keep the main account's report panel from surviving logout.
   s=s.replace('currentUser = null; lastSync = null;','currentUser = null; lastSync = null;\n  if (typeof bugAccountChanged === \'function\') bugAccountChanged();',1)
  s=s.replace("'halloween/","'alt/halloween/").replace('"halloween/','"alt/halloween/')
  writes[n]=s.encode('utf-8')
 html=text(A/'index.html')
 # Shared reward modules resolve their own assets from currentScript; reuse one catalog and artwork.
 html=html.replace('halloween/','alt/halloween/')
 html=html.replace('src="economy/','src="alt/economy/').replace('href="economy/','href="alt/economy/')
 html=html.replace('<script src="alt/halloween/rewards/preview-mode.js">','<script>window.StudentOSMainEntry = true;</script>\n  <script src="alt/halloween/rewards/preview-mode.js">',1)
 html=html.replace('<a class="alt-lab-entry" href="device-preview.html">ตรวจหน้าจอ ALT · มือถือ / แท็บเล็ต / คอม ↗</a>','')
 html=html.replace('<script src="device-preview-bridge.js"></script>','')
 html=html.replace('https://nadokagenou.github.io/studentos-ai/alt/','https://nadokagenou.github.io/studentos-ai/')
 html=html.replace('href="alt/halloween/rewards/cinematic-preview.html"','href="alt/halloween/rewards/cinematic-preview.html?entry=main"')
 for n in ['alt.css','today.css','desktop.css','desktop-entry.js','desktop.js','events.js','events.css','sai.js','hoop.js','room.js','profile.js','remote-config.js']:
  html=html.replace('src="'+n+'"','src="'+n+'?rev=main-ui-20261028"').replace('href="'+n+'"','href="'+n+'?rev=main-ui-20261028"')
 html=re.sub(r'(?m)^[ \t]+$','',html)
 writes['index.html']=html.encode('utf-8')
 # Cache the exact shared presentation resources for root clients, while leaving ALT pages alone.
 sw=text(R/'sw.js')
 sw=re.sub(r"const CACHE = '[^']+';[^\n]*","const CACHE = 'studentos-main-1c60-alt-ui-20261028'; // Requested visual parity; main push/config/storage preserved.",sw,count=1)
 refs=[]
 for ref in re.findall(r'(?:src|href)="([^"]+)"',re.sub(r'<!--.*?-->','',html,flags=re.S)):
  ref=re.split(r'[?#]',ref)[0]
  if not ref or ref.startswith(('http','#','data:')) or ref in ['manifest.json'] or not (R/ref).is_file() and ref not in writes:continue
  if ref.endswith(('.js','.css','.png','.svg','.webp','.mjs')):refs.append(ref)
 # Include permanent reward assets and loading scene artwork, without duplicating event/backend files.
 manifest=text(A/'halloween/cache-manifest.js')
 refs+=['alt/'+v for v in json.loads(manifest[manifest.index('['):manifest.rindex(']')+1])]
 refs+=['alt/halloween/season/season.css','alt/halloween/season/hook-mummy-224.webp']
 refs+=['alt/halloween/season/cursed-ship/'+x+'.webp' for x in ['ship','ship-bg','yard','yard-bg','banner','seal']]
 refs+=['hook-hat-avatar.svg','hook-hat-face.svg','hook-hat-body.svg','desktop-navigation.mjs']
 match=re.search(r'const SHELL = \[(.*?)\];',sw,re.S)
 def shell_entries(source):
  body=re.search(r'const SHELL = (\[.*?\]);',source,re.S).group(1)
  try:return json.loads(body)
  except json.JSONDecodeError:return re.findall(r"'([^']+)'",body)
 baseline=subprocess.check_output(['git','show','HEAD:sw.js'],cwd=R).decode('utf-8')
 shell=list(dict.fromkeys(shell_entries(baseline)+shell_entries(sw)+refs))
 missing=[x for x in shell if x not in writes and not (R/x).is_file() and x!='.']
 if missing:raise RuntimeError('Missing shell resources: '+str(missing))
 sw=sw[:match.start()]+'const SHELL = '+json.dumps(shell,ensure_ascii=False,indent=2)+';'+sw[match.end():]
 sw=sw.replace("if (requestUrl.pathname.startsWith(appPath + 'alt/') || requestUrl.pathname.startsWith(appPath + 'android-shortcuts/')) return;","const shared = requestUrl.pathname.startsWith(appPath + 'alt/') && SHELL.includes(requestUrl.pathname.slice(appPath.length));\n  if ((requestUrl.pathname.startsWith(appPath + 'alt/') && !shared) || requestUrl.pathname.startsWith(appPath + 'android-shortcuts/')) return;")
 writes['sw.js']=sw.encode('utf-8')
 changed=[n for n,b in writes.items() if not (R/n).exists() or (R/n).read_bytes()!=b]
 if apply:
  for n in changed:(R/n).write_bytes(writes[n])
  assert all(digest(R/n)==h for n,h in protected.items()),'Protected source changed'
  (R/'outputs/main-ui-protected-20261028.json').write_text(json.dumps(protected,indent=2),encoding='utf-8')
 print(json.dumps({'apply':apply,'changed':changed,'protectedFiles':len(protected),'shellFiles':len(shell)},ensure_ascii=False))
if __name__=='__main__':main()
