(() => {
  "use strict";
  const { random } = FrostItems;
  const MODES = {
    story: { name:"Story Run", difficulty:"Standard", description:"Cross five regions, explore hidden rooms and defeat the Frozen King.", heal:12, hp:1, windup:1 },
    hardcore: { name:"Hardcore", difficulty:"Hardcore", description:"Extra waves, faster enemy patterns and scarce healing. Records track farthest progress.", heal:0, hp:1.10, windup:.85 },
    boss: { name:"Boss Rush", difficulty:"Escalating", description:"Three bosses in succession. Choose a weapon preset and prepare at Eldric’s camp between fights.", heal:8, hp:1, windup:.92 },
    training: { name:"Training", difficulty:"Practice", heal:0, hp:1, windup:1 }
  };
  const NPC = { x: 552, y: 308 }, DISCOVERY = { x: 318, y: 310 }, SIDE = { x: 111, y: 321 };
  const TEXT = {
    opening: [
      "The kingdom did not fall in a single night.", "First came the silence.", "Then the snow.",
      "And finally, a king who refused to let winter end.", "You have crossed the frozen border for one reason.", "To reach the throne."
    ],
    king: [
      ["Frozen King","So. Another wanderer reaches my throne."],
      ["Wanderer","This winter ends tonight."],
      ["Frozen King","You mistake persistence for power. Come, then. Show me what remains of your courage."]
    ],
    phases: ["","You have learned to survive. But can you endure?","Enough! If the kingdom must fall, it will fall beneath the snow!"],
    ending: "“At last… The silence…” The crown falls. For the first time in generations, the wind carries no frost.",
    glossary: [
      ["Wanderer","นักเดินทาง"],["Throne","บัลลังก์"],["Merchant","พ่อค้า"],["Stamina","พลังความอึด"],
      ["Parry","ปัดป้อง"],["Relic","วัตถุโบราณพิเศษ"],["Frost Crown","เหรียญของอาณาจักรน้ำแข็ง"],
      ["Stagger","เสียหลัก"],["Draught","ยาดื่ม"],["Oath","คำสัตย์"]
    ]
  };
  const DIALOGUE = {
    first: [["Eldric","Another wanderer? Hah. The snow never stops bringing me fools."],
      ["Wanderer","Are you selling something?"],["Eldric","Steel, medicine, and a little hope. Though hope is terribly expensive these days."]],
    final: [["Eldric","Beyond that gate lies a king who has forgotten how to die."],
      ["Wanderer","Can he be defeated?"],["Eldric","Everything can. The question is what it costs."]],
    health: [["Eldric","You look dreadful. Excellent news for my potion business."]],
    after: [["Eldric","Well, well. Perhaps I underestimated you."]],
    again: [["Eldric","You visit me often for someone who never spends a coin."]],
    potion: [["Eldric","Planning to fight a king, or drown yourself in medicine?"]],
    welcome: [["Eldric","Back again? Your footprints held up better than the last fellow’s."]],
    kingdom: [["Wanderer","What happened to this kingdom?"],["Eldric","The crown kept the crops alive one winter. The king never took it off."]],
    identity: [["Wanderer","Who are you?"],["Eldric","I carried letters for the court. I still carry a few, though the names on them are long dead."]],
    shop: ["Take your time. The cold isn't going anywhere.","A sharp blade means nothing in careless hands.","Don't spend everything. The road ahead is cruel.","I’ve buried customers richer than you."],
    bought: ["A sensible choice. Probably.","May it serve you better than its previous owner."],
    poor: ["That costs more than you've got, wanderer.","Come back when your pockets sound heavier."]
  };
  const regions = [
    ["The Forgotten Outpost","courtyard","The last Warden’s watchfire is buried beside the ruined gate.",["stalker","stalker","stalker"],null],
    ["Hollowpine Forest","forest","Keep an eye on the treeline. Footsteps continue after you stop.",["stalker","wolf","archer","wolf"],"ambush"],
    ["Crystal Depths","crystal","The ice beneath the floor is splitting. Watch for circles before they erupt.",["archer","sentinel","wolf","stalker"],"frost"],
    ["The Silent Capital","gallery","Broken masonry still drops from the bell tower that overlooks the city.",["elite","archer","sentinel","stalker","wolf"],"debris"],
    ["The Frozen Throne","throne","The Warden who once trained you rises from the throne.",["king"],"frost"]
  ];
  const layouts = [
    [[151,270,22],[809,270,22],[210,460,17],[750,460,17]],
    [[242,235,20],[718,235,20],[242,420,20],[718,420,20]],
    [[283,294,24],[677,294,24],[305,456,20],[655,456,20]],
    [[336,225,19],[624,225,19],[336,416,19],[624,416,19]]
  ];
  const safe = (stage, type, name, theme, story, extra = {}) => ({
    stage, type, name, theme, story, enemies:[], pillars:layouts[0], objective:"Continue through the north gate when ready.", ...extra
  });
  function route(mode, seed) {
    const rng = random(seed);
    if (mode === "boss") return [
      { stage:1, type:"boss", name:"The Gatekeeper", theme:"courtyard", story:"The outpost’s captain still answers the alarm.", objective:"Defeat the Gatekeeper.", enemies:["keeper"], pillars:layouts[0] },
      safe(1,"merchant","The Roadside Lantern","forest","Eldric has found a place out of the wind."),
      { stage:2, type:"boss", name:"The Crystal Warden", theme:"crystal", story:"The Warden’s footsteps ring through every seam in the ice.", objective:"Defeat the Crystal Warden.", enemies:["warden"], pillars:layouts[2], hazard:"frost" },
      safe(2,"merchant","The King’s Stair","gallery","Eldric waits beside the last door.",{ finalShop:true }),
      { stage:3, type:"boss", name:"The Frozen Throne", theme:"throne", story:regions[4][2], objective:"Break the crown.", enemies:["king"], pillars:layouts[3] }
    ];
    return regions.flatMap(([name,theme,story,enemies,hazard],i) => {
      const stage = i+1;
      const pillars = layouts[Math.floor(rng()*layouts.length)];
      const rooms = [];
      if (stage === 5) rooms.push(safe(stage,"merchant","The King’s Stair","gallery","You recognize the device on the door. It belongs to your old teacher.",{ finalShop:true }));
      const type = stage === 5 ? "boss" : stage === 4 ? "elite" : "combat";
      const waves = mode === "hardcore" && stage !== 5 ? [enemies, i < 2 ? ["wolf","archer","stalker"] : ["elite","archer","wolf"]] : [enemies];
      rooms.push({ stage,type,name,theme,story,objective:stage === 5 ? "Defeat the Frozen King." :
        stage===2 ? "Clear the ambush. Search the west wall for the half-buried trail marker." : "Clear the encounter to unlock the north gate.",
        enemies,waves,pillars,hazard, secretClue:stage===2?"tracks":null,
        side:stage===2 ? safe(stage,"treasure","The Hollow Cache","forest","The trail leads to a chest beneath a pine.",{hidden:true}) : null });
      if (stage === 1) rooms.push(safe(stage,"merchant","Eldric’s Lantern","courtyard","A lantern glows in the lee of a collapsed watchtower."));
      if (stage === 3) rooms.push(
        safe(stage,"rest","Stillwater Shrine","crystal","Water still trickles beneath the stone. The air here is warmer."),
        safe(stage,"merchant","The Broken Stair","bridge","A lantern shifts in the wind where a stair once led up to the city.")
      );
      if (stage === 4) rooms.push(safe(stage,"lore","The Oath Crypt","crypt","An empty tomb bears the King’s oath.",{ lore:"He bound winter to his crown to prevent a famine. Every spring he wore it made the next winter longer." }));
      return rooms;
    });
  }
  globalThis.FrostWorld = { MODES, NPC, DISCOVERY, SIDE, TEXT, DIALOGUE, route, training:route("story",0)[0] };
})();
