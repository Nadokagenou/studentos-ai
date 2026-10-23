# NPC และห้องเพิ่มเติม · 23 ตุลาคม 2569

สร้างด้วย image_gen แบบ built-in และคัดลอกเข้าโปรเจกต์ ภาพต้นฉบับยังอยู่ใน generated_images ไม่แก้ภาพรางวัลเดิม

## ไฟล์ที่ใช้จริง

| ภาพ | ไฟล์ในโปรเจกต์ | ภาพต้นฉบับ |
|---|---|---|
| ร้านค้า | ../event/assets/world-shop.png | exec-9dce3071-d447-4ab2-99bd-840947bd775f.png |
| ห้องเตาผสม | ../event/assets/world-cauldron.png | exec-802cd642-13ec-46c7-ae8c-550743e1f27c.png |
| ห้องวงเวท | ../event/assets/world-ritual.png | exec-8ca1d6aa-bf89-464e-9668-045b2a83c1e2.png |
| สวนส่วนกลาง | ../event/assets/world-garden.png | exec-6c4cc740-7400-4d84-b508-884c84d2030f.png |
| NPC atlas 7 ตัว | ../event/assets/npc-atlas.png | exec-d98c94b6-fb67-4aee-a267-1761b5403698.png |

ต้นฉบับ: C:/Users/This PC/.codex/generated_images/01a166e5-a44b-7c91-bc9e-bad99ccfc00c

Atlas 1536×1024, 4×2 ช่อง ช่องสุดท้ายว่าง ตรวจ alpha มุม/ช่องว่างเป็น 0 จริง ใช้ CSS แสดงเฉพาะช่อง ไม่ตัดแก้รูปต้นฉบับ

บทพูด NPC เสริมอยู่ event/npcs.js ส่วน Tang/Jack/Dech/Win ยังคงบทเควสเดิม

## Prompt · shop

Use case: stylized-concept. Asset: environment background for the SAME StudentOS Halloween pixel-art point-and-click RPG. Authentic crisp 16-bit pixel clusters, visible square pixels, limited palette, no smooth painting or blur. 3:2 wide framing. Eerie majestic but readable, blue-silver moonlight, deep shadows, muted warm practical lighting with at most three lanterns at functional places. Every light has a visible source and local falloff. No decorative candle spam, no glowing patches on ordinary floors. No text, labels, buttons, UI, watermark, or characters; characters will be separate sprites. Fixed camera, beautiful game-ready environment with clear interaction landmarks.
Scene: Interior of an old nocturnal fantasy merchant shop. Wooden counter runs across middle back at y58%, empty space BEHIND counter centered x50% for a standing merchant sprite. Shelves with a few strange bottles, folded cloth, nautical trinkets. Left counter weighing scales and empty produce basket for buying harvested crops. Right side display cabinet for collectible rewards. Open foreground floor. Cool moonlight through rear-left window, ONE warm lantern near counter and a small desk candle. Quiet antique shop, mysterious rather than crowded.

## Prompt · cauldron

Use case: stylized-concept. Asset: environment background for the SAME StudentOS Halloween pixel-art point-and-click RPG. Authentic crisp 16-bit pixel clusters, visible square pixels, limited palette, no smooth painting or blur. 3:2 wide framing. Eerie majestic but readable, blue-silver moonlight, deep shadows, muted warm practical lighting with at most three lanterns at functional places. Every light has a visible source and local falloff. No decorative candle spam, no glowing patches on ordinary floors. No text, labels, buttons, UI, watermark, or characters; characters will be separate sprites. Fixed camera, beautiful game-ready environment with clear interaction landmarks.
Scene: Interior of a witch's stone brewing cottage. Large iron cauldron at x70% y66%, purple liquid is the only magical emission and softly lights nearby stones. Empty standing space at x31% y72% for witch sprite. Ingredient shelves left/back, hanging dried herbs, a worn recipe book at x48% y46%. Broad open foreground floor. Tall narrow moonlit window in rear, one small lantern by doorway. No random magical lights.

## Prompt · ritual

Use case: stylized-concept. Asset: environment background for the SAME StudentOS Halloween pixel-art point-and-click RPG. Authentic crisp 16-bit pixel clusters, visible square pixels, limited palette, no smooth painting or blur. 3:2 wide framing. Eerie majestic but readable, blue-silver moonlight, deep shadows, muted warm practical lighting with at most three lanterns at functional places. Every light has a visible source and local falloff. No decorative candle spam, no glowing patches on ordinary floors. No text, labels, buttons, UI, watermark, or characters; characters will be separate sprites. Fixed camera, beautiful game-ready environment with clear interaction landmarks.
Scene: Interior of an ancient wizard's ritual chamber. Circular engraved summoning circle on floor centered x48% y68%, dim violet runes physically engraved in stone provide subtle light. Leave standing space at x79% y69% for wizard sprite. Old grimoire pedestal back-left x25% y38%, tall pillars, shelves of scrolls, arched moonlit window. Two restrained wall lamps. Circle distinct from cauldron room; no cauldron. Broad clear foreground.

## Prompt · garden

Use case: stylized-concept. Asset: environment background for the SAME StudentOS Halloween pixel-art point-and-click RPG. Authentic crisp 16-bit pixel clusters, visible square pixels, limited palette, no smooth painting or blur. 3:2 wide framing. Eerie majestic but readable, blue-silver moonlight, deep shadows, muted warm practical lighting with at most three lanterns at functional places. Every light has a visible source and local falloff. No decorative candle spam, no glowing patches on ordinary floors. No text, labels, buttons, UI, watermark, or characters; characters will be separate sprites. Fixed camera, beautiful game-ready environment with clear interaction landmarks.
Scene: New separate midnight greenhouse garden courtyard, empty garden beds, not any of the four biomes. Four EMPTY rectangular soil beds arranged two by two, centers at (32%,48%), (67%,48%), (32%,76%), (67%,76%), each about25% image width and15% image height. All four beds clear and unobstructed for overlaying planted crop sprites. Stone paths between beds, low wooden edging. Small moonlit greenhouse at back, water barrel right edge, seed storage shed left edge, entrance gate back-center. A few weeds outside beds only. Clear blue moonlight from upper right, one practical lantern by shed, no magical light on soil. No planted pumpkins or other crops in these empty beds.

## Prompt · NPC atlas

Use case: stylized-concept. Asset type: a SINGLE transparent PNG sprite atlas for a 16-bit pixel RPG. EXACT grid of 4 columns by 2 rows, eight equally sized invisible cells, 3:2 overall canvas. SEVEN different full-body NPCs, one character centered in each cell, last eighth cell EMPTY TRANSPARENT. No grid lines, backgrounds, text or UI. Sharp pixel clusters and blocky stepped silhouettes, NOT smooth painted characters. Consistent 3/4 front view facing player, all same scale around 80% of cell height, feet aligned at90% of each cell height, generous transparent padding inside each cell, no overlap across cells. Each character complete head-to-feet with silhouette clearly separated. Reading order left-to-right top row then bottom row: 1 Tang the Sailor, weathered male sailor in dark navy long coat, tricorn hat, beard, holding a small warm lantern; 2 Jack'o Tigger, mischievous pumpkin-headed scarecrow man in worn purple coat and floppy black witch hat, straw hands; 3 Mr Dech, aristocratic male vampire, pale face, swept black hair, red velvet waistcoat, long black cape, feather quill; 4 Win the Soul Reaper, hooded charcoal-robed mysterious skeletal reaper with a simple scythe, no gore; 5 Morro the shopkeeper, older male merchant in brown vest over cream shirt, teal scarf, round spectacles, coin purse, warm slightly sly expression; 6 Mora the witch, adult female witch in muted purple dress and crooked pointed hat, silver hair, wooden stirring spoon, calm playful expression; 7 Vesper the wizard, older male wizard in faded midnight blue robes and pointed hat, gray beard, small wooden staff with dim violet stone, enigmatic expression; 8 EMPTY. Limited colors, restrained highlights. Absolutely transparent background, no floor, no drop shadows outside character, no props detached from characters. Grid discipline is essential because each cell will be displayed separately by CSS.

