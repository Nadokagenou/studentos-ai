# ภาพฉากแนวตั้ง · 23 ตุลาคม 2026

ใช้ imagegen skill โหมด built-in image_gen ไม่มี API key/CLI ภาพอ้างอิงเป็นฉากเกมเดิมที่สร้างไว้ในโปรเจกต์ ไม่ทับภาพแนวนอนเดิม ต้นฉบับยังอยู่ใน C:/Users/This PC/.codex/generated_images/01a166e5-a44b-7c91-bc9e-bad99ccfc00c/ และคัดลอกชิ้นที่เลือกเข้า event/assets/ แล้ว

ภาพแนวตั้งแยกจากแนวนอนด้วย picture/source media orientation:portrait ภาพ atlas แต่ละช่องถูกแสดงทีละช่องในฉากเกม ไม่ใช่การแสดงทั้งตารางให้ผู้เล่น ภาพทุกช่องมีสัดส่วนใกล้ 9:16 ปรับทั้งฉากพร้อมจุดกดตามตำแหน่งแนวตั้ง ไม่เลื่อนกล้องหรือครอปประตูออกนอกจอ

## portrait-hub.png

- ไฟล์ในเกม: event/assets/portrait-hub.png
- ต้นฉบับ: exec-fa91b1ae-b0f1-4120-a702-8936f02f75e0.png
- ภาพอ้างอิง: event/assets/world-hub.png
- การใช้: โถงและประตูทางเข้า ภาพเต็มเดี่ยว

### Prompt

Use case: stylized-concept. Asset: ONE new PORTRAIT 9:16 pixel RPG background for mobile, adapt attached landscape hub into a complete portrait composition. Keep EXACT same crisp 16-bit pixel art materials, dark mysterious spooky moonlit academy and restrained plausible lamps, not pitch black. NO text, NO UI, NO characters. Every destination must fit on a SINGLE vertical screen. Camera looks slightly downward. Upper 12 percent moonlit sky for HUD. Middle area contains FOUR LARGE separate stone portal arches in a 2 by 2 arrangement on a tiered stone wall: upper-left ghost ship cyan doorway centered x28%, y27%; upper-right pumpkin grove orange doorway x72%, y27%; lower-left vampire castle red doorway x28%, y49%; lower-right graveyard violet doorway x72%, y49%. Each portal opening about 28% image width, 19% image height, fully visible, separated by stonework. Ground lower half: small magical merchant shop lower left centered x16%,y72%, witch tent with purple cauldron lower right x84%,y72%, stone ritual compass circle at x50%,y79%, small ivy garden gate at x22%,y85%. Bottom 10% simple cobblestones for overlaid tool HUD. Only two small amber lanterns near paving plus practical shop lamp and cauldron glow. Beautiful ancient arcane haunted atmosphere, visible pixel edges, detailed yet readable at phone size. Fill entire 9:16 canvas, no borders, no montage.

## portrait-biomes.png

- ไฟล์ในเกม: event/assets/portrait-biomes.png
- ต้นฉบับ: exec-61b71318-0f5d-40bf-9ac6-904b228a3d43.png
- ภาพอ้างอิง: event/assets/world-dutchman.png, event/assets/world-jack.png, event/assets/world-vampire.png, event/assets/world-graveyard.png
- การใช้: atlas 2×2: เรือ / Jack / Vampire / Graveyard

### Prompt

Use case: stylized-concept. Asset: ONE sprite BACKGROUND ATLAS for a mobile pixel RPG. Overall portrait 9:16 canvas EXACTLY split into a 2x2 grid of FOUR edge-to-edge PORTRAIT 9:16 game scenes, no gaps, no divider lines, no labels. The four supplied landscape images are style and location references. Recompose each as a complete vertical scene. Match crisp 16-bit pixel clusters, same haunting readable moonlight, sparse practical lights; no text, UI, characters or frames. Grid: TOP LEFT ghost ship dock, TOP RIGHT pumpkin garden, BOTTOM LEFT vampire mansion courtyard, BOTTOM RIGHT haunted graveyard. Each cell needs safe empty sky/top 15% for title and ground/bottom 10% for HUD. All props inside cell, never crossing grid. Ghost ship: towering moored ship fills upper-right, treasure/ship boarding spot at cell x72%,y42%; small village alley sign arch at x15%,y30%; EMPTY sailor standing patch x24%,y77%. Pumpkin: spooky twisting trees and pumpkin grounds, vine overgrown patch x25%,y51%, village path arch x15%,y30%, EMPTY pumpkin NPC standing patch x76%,y77%. Vampire: vertical gothic mansion with red moon, main mansion door x70%,y41%, village alley arch x15%,y30%, EMPTY vampire standing patch x25%,y77%. Graveyard: ruined chapel and graves with dim mystical fog, digging earth patch x27%,y59%, floating faint spirit wisps x70%,y35%, village path arch x15%,y30%, EMPTY reaper standing patch x78%,y77%. Every cell must be a continuous independent full-screen scene. NO people, skeletons or NPCs. NO text or symbols that look like UI.

## portrait-rooms.png

- ไฟล์ในเกม: event/assets/portrait-rooms.png
- ต้นฉบับ: exec-567a0449-4137-4652-bda1-a593c78466a5.png
- ภาพอ้างอิง: event/assets/world-shop.png, event/assets/world-cauldron.png, event/assets/world-ritual.png, event/assets/world-garden.png
- การใช้: atlas 2×2: ร้าน / เตา / วงเวท / สวน

### Prompt

Use case: stylized-concept. Asset: ONE BACKGROUND ATLAS for a mobile pixel RPG. Overall portrait 9:16 canvas EXACT 2x2 equal grid of FOUR edge-to-edge PORTRAIT 9:16 scenes, no gutters/dividers/labels. Supplied scenes are style and subject references, transform into vertical compositions. Match crisp 16-bit pixel art, spooky arcane mood, detailed readable moonlight, restrained real light sources. No people, NPCs, text, icons, menus, frames or UI. Every cell has top 13% quiet architecture for overlaid header and bottom 10% simple ground for tool HUD. TOP LEFT merchant shop: narrow tall gothic window on left, ancient shelves behind wooden counter, lit curio cabinet right at x84%,y46%, scales left x17%,y49%, EMPTY merchant standing floor patch at x53%,y76%, one warm lamp, moonlight. TOP RIGHT witch laboratory: tall shelves and herbs, glowing purple cauldron RIGHT at x74%,y52%, EMPTY witch standing patch LEFT at x26%,y77%, one dim practical lamp. BOTTOM LEFT wizard ritual chamber: tall ruined mystical stone walls, floor rune circle CENTER x47%,y65%, EMPTY wizard standing patch right x78%,y77%, dim violet light comes only from circle, moonlight. BOTTOM RIGHT communal night garden: moonlit greenhouse at back, FOUR LARGE CLEAR EMPTY SOIL BEDS in 2x2 layout centered (x28%,y43%), (x72%,y43%), (x28%,y68%), (x72%,y68%), each bed 36% cell width 16% cell height, simple paths between them, no plants in beds, no characters. Entire composition perfect equal 2x2 grid, each cell complete vertical environment.

แอนิเมชันฝุ่น หมอก การขยับ NPC และ feedback จุดกดเป็น CSS ของฉาก ไม่ได้สร้างเฟรมตัวละครเพิ่ม ภาพพิสูจน์ UI อยู่ preview-portrait-hub-2026-10-23.jpg และเอกสาร FULLSCREEN-GUIDE-2026-10-23.md
