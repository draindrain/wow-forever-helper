// Hand-maintained facts that aren't in a machine-readable Forever source.
// Each entry names where it came from; `confirmed: false` marks values carried
// over from Classic that no Forever source has confirmed yet. Update these as
// Blizzard publishes more.

// Talent trees per class. `school` is the spellbook tab (and talent tree) name
// the Forever client uses, which differs from the tree's usual name in two cases.
export const SPECS = {
  warrior: [
    { id: 'arms', name: 'Arms', school: 'Arms', role: 'Damage' },
    { id: 'fury', name: 'Fury', school: 'Fury', role: 'Damage' },
    { id: 'protection', name: 'Protection', school: 'Protection', role: 'Tank' },
  ],
  paladin: [
    { id: 'holy', name: 'Holy', school: 'Holy', role: 'Healer' },
    { id: 'protection', name: 'Protection', school: 'Protection', role: 'Tank' },
    { id: 'retribution', name: 'Retribution', school: 'Retribution', role: 'Damage' },
  ],
  hunter: [
    { id: 'beast-mastery', name: 'Beast Mastery', school: 'Beast Mastery', role: 'Damage' },
    { id: 'marksmanship', name: 'Marksmanship', school: 'Marksmanship', role: 'Damage' },
    { id: 'survival', name: 'Survival', school: 'Survival', role: 'Damage' },
  ],
  rogue: [
    { id: 'assassination', name: 'Assassination', school: 'Assassination', role: 'Damage' },
    { id: 'combat', name: 'Combat', school: 'Combat', role: 'Damage' },
    { id: 'subtlety', name: 'Subtlety', school: 'Subtlety', role: 'Damage' },
  ],
  priest: [
    { id: 'discipline', name: 'Discipline', school: 'Discipline', role: 'Healer' },
    { id: 'holy', name: 'Holy', school: 'Holy', role: 'Healer' },
    { id: 'shadow', name: 'Shadow', school: 'Shadow Magic', role: 'Damage' },
  ],
  shaman: [
    { id: 'elemental', name: 'Elemental', school: 'Elemental Combat', role: 'Damage' },
    { id: 'enhancement', name: 'Enhancement', school: 'Enhancement', role: 'Damage' },
    { id: 'restoration', name: 'Restoration', school: 'Restoration', role: 'Healer' },
  ],
  mage: [
    { id: 'arcane', name: 'Arcane', school: 'Arcane', role: 'Damage' },
    { id: 'fire', name: 'Fire', school: 'Fire', role: 'Damage' },
    { id: 'frost', name: 'Frost', school: 'Frost', role: 'Damage' },
  ],
  warlock: [
    { id: 'affliction', name: 'Affliction', school: 'Affliction', role: 'Damage' },
    { id: 'demonology', name: 'Demonology', school: 'Demonology', role: 'Damage' },
    { id: 'destruction', name: 'Destruction', school: 'Destruction', role: 'Damage' },
  ],
  druid: [
    { id: 'balance', name: 'Balance', school: 'Balance', role: 'Damage' },
    { id: 'feral', name: 'Feral Combat', school: 'Feral Combat', role: 'Tank / Damage' },
    { id: 'restoration', name: 'Restoration', school: 'Restoration', role: 'Healer' },
  ],
};

// Client race IDs (ChrRaces) -> site race id, starting zone (Wowhead zone id).
// Skyborne start on Zephras Isle and leave by airship to Dalaran (Alliance) or
// Mulgore (Horde) — warcraft.wiki.gg/wiki/Zephras_Isle.
export const RACES = [
  { clientId: 1, id: 'human', startZone: 12 },
  { clientId: 3, id: 'dwarf', startZone: 1 },
  { clientId: 7, id: 'gnome', startZone: 1 },
  { clientId: 4, id: 'nightelf', startZone: 141 },
  { clientId: 95, id: 'highorder-skyborne', startZone: 16593, display: 'High Order Skyborne' },
  { clientId: 2, id: 'orc', startZone: 14 },
  { clientId: 8, id: 'troll', startZone: 14 },
  { clientId: 6, id: 'tauren', startZone: 215 },
  { clientId: 5, id: 'undead', startZone: 85 },
  { clientId: 96, id: 'windshaper-skyborne', startZone: 16593, display: 'Windshaper Skyborne' },
];

// Zone facts the Wowhead quest data can't supply yet (keyed by Wowhead zone id).
//   races: only these races can reach the zone
//   range: used when too few of the zone's quests are catalogued to derive one
export const ZONE_OVERRIDES = {
  16593: {
    races: ['highorder-skyborne', 'windshaper-skyborne'],
    note: 'Skyborne starting zone. The Skyborne packs unlock the race and Zephras Isle.',
  },
  16591: {
    range: [36, 44],
    note: 'New contested zone east of the Badlands, with the Krol\'dok Stronghold dungeon. Range is Wowhead\'s zone record; Blizzard has said "mid-30s to mid-40s".',
  },
  616: {
    range: [60, 60],
    note: 'Level 60 zone with the Barrow Deeps and Hyjal Summit raids.',
  },
  16651: {
    note: 'New zone between Mulgore, Desolace and Feralas (Highborne ruins, Gelkis vs. Magram centaur). Blizzard hasn\'t published a range; this one comes from the few quests catalogued so far.',
  },
};

// Dungeon level ranges as Blizzard announced them (Kaivax, Blizzard forums,
// Sept 2026; tabulated on warcraft.wiki.gg/wiki/World_of_Warcraft:_Forever).
// `client` is the wowforevertalents.com instance slug, which carries the
// client's own entry level and group size. `map` is the instance's map id in the
// client, whose DungeonEncounter table lists its bosses in order (instances not in
// the client build yet have none). `bosses` narrows a multi-wing instance to the
// wing's bosses.
export const DUNGEONS = [
  { id: 'hall-of-thanes', name: 'The Hall of Thanes', zone: 'Ironforge', min: 13, max: 18, client: 'the-hall-of-thanes', map: 3065, isNew: true },
  { id: 'ragefire-chasm', name: 'Ragefire Chasm', zone: 'Orgrimmar', min: 13, max: 19, client: 'ragefire-chasm', map: 389, faction: 'Horde' },
  { id: 'ruins-of-lordaeron', name: 'Ruins of Lordaeron', zone: 'Undercity', min: 15, max: 22, client: 'ruins-of-lordaeron', map: 2999, isNew: true },
  { id: 'deadmines', name: 'The Deadmines', zone: 'Westfall', min: 18, max: 24, client: 'deadmines', map: 36 },
  { id: 'wailing-caverns', name: 'Wailing Caverns', zone: 'The Barrens', min: 19, max: 25, client: 'wailing-caverns', map: 43 },
  { id: 'shadowfang-keep', name: 'Shadowfang Keep', zone: 'Silverpine Forest', min: 23, max: 29, client: 'shadowfang-keep', map: 33 },
  { id: 'excavation-site-wetlands', name: 'Excavation Site: Wetlands', zone: 'Wetlands', min: 24, max: 29, client: 'excavation-site-wetlands', map: 2998, isNew: true },
  { id: 'blackfathom-deeps', name: 'Blackfathom Deeps', zone: 'Ashenvale', min: 25, max: 31, client: 'blackfathom-deeps', map: 48 },
  { id: 'stormwind-stockade', name: 'The Stockade', zone: 'Stormwind City', min: 26, max: 32, client: 'stormwind-stockade', map: 34, faction: 'Alliance' },
  { id: 'city-of-dalaran', name: 'City of Dalaran', zone: 'Alterac Mountains', min: 28, max: 33, client: 'city-of-dalaran', map: 2959, isNew: true },
  { id: 'razorfen-kraul', name: 'Razorfen Kraul', zone: 'The Barrens', min: 30, max: 36, client: 'razorfen-kraul', map: 47 },
  { id: 'gnomeregan', name: 'Gnomeregan', zone: 'Dun Morogh', min: 31, max: 37, client: 'gnomeregan', map: 90 },
  { id: 'sm-graveyard', name: 'Scarlet Monastery: Graveyard', zone: 'Tirisfal Glades', min: 31, max: 37, client: 'scarlet-monastery', map: 189, bosses: ['Interrogator Vishas', 'Bloodmage Thalnos'] },
  { id: 'sm-library', name: 'Scarlet Monastery: Library', zone: 'Tirisfal Glades', min: 34, max: 40, client: 'scarlet-monastery', map: 189, bosses: ['Houndmaster Loksey', 'Arcanist Doan'] },
  { id: 'drowned-city', name: 'The Drowned City', zone: 'Stranglethorn Vale', min: 35, max: 40, client: 'the-drowned-city', isNew: true },
  { id: 'sm-armory', name: 'Scarlet Monastery: Armory', zone: 'Tirisfal Glades', min: 37, max: 43, client: 'scarlet-monastery', map: 189, bosses: ['Herod'] },
  { id: 'razorfen-downs', name: 'Razorfen Downs', zone: 'The Barrens', min: 38, max: 44, client: 'razorfen-downs', map: 129 },
  { id: 'sm-cathedral', name: 'Scarlet Monastery: Cathedral', zone: 'Tirisfal Glades', min: 39, max: 45, client: 'scarlet-monastery', map: 189, bosses: ['High Inquisitor Fairbanks', 'High Inquisitor Whitemane'] },
  { id: 'kroldok-stronghold', name: "Krol'dok Stronghold", zone: 'Riverglades', min: 40, max: 45, client: 'krol-dor-stronghold', isNew: true },
  { id: 'uldaman', name: 'Uldaman', zone: 'Badlands', min: 44, max: 50, client: 'uldaman', map: 70 },
  { id: 'zulfarrak', name: "Zul'Farrak", zone: 'Tanaris', min: 45, max: 51, client: 'zul-farrak', map: 209 },
  { id: 'alcaz-prison', name: 'Alcaz Prison', zone: 'Dustwallow Marsh', min: 48, max: 53, client: 'defias-prison', isNew: true },
  { id: 'maraudon', name: 'Maraudon', zone: 'Desolace', min: 48, max: 54, client: 'maraudon', map: 349 },
  { id: 'sunken-temple', name: "Temple of Atal'Hakkar", zone: 'Swamp of Sorrows', min: 52, max: 58, client: 'sunken-temple', map: 109 },
  { id: 'blackrock-depths', name: 'Blackrock Depths', zone: 'Blackrock Mountain', min: 52, max: 60, client: 'blackrock-depths', map: 230 },
  { id: 'dm-east', name: 'Dire Maul: Warpwood Quarter', zone: 'Feralas', min: 55, max: 60, client: 'dire-maul', map: 429, bosses: ['Zevrim Thornhoof', 'Hydrospawn', 'Lethtendris', 'Pusillin', 'Alzzin the Wildshaper'] },
  { id: 'blackmaw-hold', name: 'Blackmaw Hold', zone: 'Azshara', min: 55, max: 60, client: 'blackmaw-hold', isNew: true },
  { id: 'lbrs', name: 'Lower Blackrock Spire', zone: 'Blackrock Mountain', min: 55, max: 60, client: 'blackrock-spire', map: 229, bosses: ['Highlord Omokk', "Shadow Hunter Vosh'gajin", 'War Master Voone', 'Mother Smolderweb', 'Urok Doomhowl', 'Quartermaster Zigris', 'Halycon', 'Gizrul the Slavener', 'Overlord Wyrmthalak'] },
  { id: 'dm-west', name: 'Dire Maul: Capital Gardens', zone: 'Feralas', min: 58, max: 60, client: 'dire-maul', map: 429, bosses: ['Tendris Warpwood', 'Illyanna Ravenoak', 'Magister Kalendris', "Immol'thar", 'Prince Tortheldrin'] },
  { id: 'scholomance', name: 'Scholomance', zone: 'Western Plaguelands', min: 58, max: 60, client: 'scholomance', map: 289 },
  { id: 'shapers-terrace', name: "Shaper's Terrace", zone: "Un'Goro Crater", min: 58, max: 60, client: 'shaper-s-terrace', isNew: true },
  { id: 'stratholme', name: 'Stratholme', zone: 'Eastern Plaguelands', min: 58, max: 60, client: 'stratholme', map: 329 },
  { id: 'dm-north', name: 'Dire Maul: Gordok Commons', zone: 'Feralas', min: 58, max: 60, client: 'dire-maul', map: 429, bosses: ["Guard Mol'dar", 'Stomper Kreeg', 'Guard Fengus', "Guard Slip'kik", 'Captain Kromcrush', 'King Gordok', "Cho'Rush the Observer"] },
];

// Launch raids (warcraft.wiki.gg/wiki/World_of_Warcraft:_Forever). Open 9 Dec 2026.
export const RAIDS = [
  { id: 'barrow-deeps', name: 'Barrow Deeps', zone: 'Mount Hyjal', size: 10, isNew: true },
  { id: 'hyjal-summit', name: 'Hyjal Summit', zone: 'Mount Hyjal', size: 20, isNew: true },
  { id: 'onyxias-lair', name: "Onyxia's Lair", zone: 'Dustwallow Marsh', size: 40 },
];

// Wowhead (Forever) zone ids for each instance: their pages list the quests filed
// under the instance, and their map images. Announced instances with no Wowhead
// zone yet are left out. Multi-wing instances share one zone and its quests.
export const INSTANCE_ZONES = {
  'hall-of-thanes': [16919],
  'ragefire-chasm': [2437],
  'ruins-of-lordaeron': [16611],
  deadmines: [1581],
  'wailing-caverns': [718],
  'shadowfang-keep': [209],
  'excavation-site-wetlands': [16732],
  'blackfathom-deeps': [719],
  'stormwind-stockade': [717],
  'city-of-dalaran': [16544, 16560],
  'razorfen-kraul': [491],
  gnomeregan: [721],
  'sm-graveyard': [796],
  'sm-library': [796],
  'sm-armory': [796],
  'sm-cathedral': [796],
  'razorfen-downs': [722],
  uldaman: [1337],
  zulfarrak: [1176],
  maraudon: [2100],
  'sunken-temple': [1477, 1417],
  'blackrock-depths': [1584, 17803],
  'dm-east': [2557],
  'dm-west': [2557],
  'dm-north': [2557],
  lbrs: [1583, 17804],
  scholomance: [2057],
  stratholme: [2017],
  'onyxias-lair': [2159],
};

// Keys and attunements as Classic has them, by the quest that completes each chain;
// the build pulls in the whole chain from that quest's series. The site checks each
// quest exists in Wowhead's Forever database and drops any that don't.
// optional: a shortcut, not needed to enter.
export const ATTUNEMENTS = {
  'onyxias-lair': [
    { title: 'Drakefire Amulet', faction: 'Alliance', quest: 6502 },
    { title: 'Blood of the Black Dragon Champion', faction: 'Horde', quest: 6602 },
  ],
  scholomance: [
    { title: 'Skeleton Key', faction: 'Alliance', quest: 5505 },
    { title: 'Skeleton Key', faction: 'Horde', quest: 5511 },
  ],
  'blackrock-depths': [{ title: 'Shadowforge Key', quest: 3802, optional: true }],
  maraudon: [{ title: 'Scepter of Celebras', quest: 7046, optional: true }],
};

// Battleground queue level bands, from the Forever client's queue list
// (wowforevertalents.com/dungeons/).
export const BATTLEGROUNDS = [
  { id: 'warsong-gulch', name: 'Warsong Gulch', min: 10, size: '10v10' },
  { id: 'arathi-basin', name: 'Arathi Basin', min: 20, size: '15v15' },
  { id: 'darkspear-islands', name: 'Darkspear Islands', min: 30, size: '15v15', isNew: true },
  { id: 'alterac-valley', name: 'Alterac Valley', min: 51, size: '40v40' },
];

// Profession ranks. Max skills are the client's own; the character level each
// rank needs is set by the server. Journeyman at 10 has been reported from the
// beta; Expert and Artisan are the Classic values until Forever confirms them.
export const PROFESSION_RANKS = [
  { name: 'Apprentice', maxSkill: 75, minSkill: 0, level: 5, confirmed: false },
  { name: 'Journeyman', maxSkill: 150, minSkill: 50, level: 10, confirmed: true },
  { name: 'Expert', maxSkill: 225, minSkill: 125, level: 20, confirmed: false },
  { name: 'Artisan', maxSkill: 300, minSkill: 200, level: 35, confirmed: false },
];

// Level milestones that aren't class spells. `classes` limits one to some classes.
export const MILESTONES = [
  { level: 5, title: 'Camping', text: 'Camping unlocks around level 5 through quests such as "The Great Outdoors". Build a campfire and let other players add tradeskill buffs to it.', source: 'warcraft.wiki.gg (Forever)', confirmed: true },
  { level: 10, title: 'Talent points', text: 'You get your first talent point at 10 and one more every level, 51 in total at 60.', source: 'Forever client talent trees (51 points)', confirmed: true },
  { level: 14, title: 'Cozy Sleeping Bag hunt', text: 'A scavenger hunt in Westfall or the Barrens rewards the Cozy Sleeping Bag, which gives a stacking XP buff and lets you earn rested XP while logged out.', source: 'warcraft.wiki.gg (Forever)', confirmed: true },
  { level: 25, title: 'Legacy challenge', text: 'Reaching 25 completes a Legacy challenge. Legacy Points are earned account-wide and spent per character in the Legacy Trees.', source: 'warcraft.wiki.gg (Forever)', confirmed: true },
  { level: 40, title: 'Dual talent specialization', text: 'Buy Dual Spec from your class trainer for 10 gold, then swap between two specs freely outside combat.', source: 'Blizzard (warcraft.wiki.gg)', confirmed: true },
  { level: 40, title: 'Legacy challenge', text: 'Reaching 40 completes another Legacy challenge.', source: 'warcraft.wiki.gg (Forever)', confirmed: true },
  { level: 40, title: 'Riding', text: 'Apprentice Riding is in the Forever client. Classic teaches it at 40; Forever hasn\'t confirmed its level yet.', source: 'Classic value', confirmed: false },
  { level: 60, title: 'Level cap', text: 'Forever stays at 60 for good. Launch raids (Barrow Deeps, Hyjal Summit, Onyxia\'s Lair) open on 9 December 2026.', source: 'Blizzard (warcraft.wiki.gg)', confirmed: true },
  { level: 60, title: 'Legacy challenge', text: 'Reaching 60 completes the last leveling Legacy challenge.', source: 'warcraft.wiki.gg (Forever)', confirmed: true },
];

// Boss pins on dungeon maps. Positions are Classic's (CMaNGOS classic-db spawns),
// projected onto Wowhead's map image with a fit made by scripts/fit-dungeon-maps.mjs.
// Only maps whose fit was checked by eye get pins: Deadmines, Shadowfang Keep,
// Scarlet Monastery and Zul'Farrak images don't line up with a plain projection,
// Lower Blackrock Spire and Onyxia's Lair have no image, and Forever's new
// dungeons have no Classic data.
export const PINNED_MAPS = [389, 43, 48, 34, 47, 90, 129, 70, 349, 109, 230, 429, 289, 329];

// Encounters whose name isn't a creature with a fixed spawn: pin them on the
// creature they appear with (or the client's spelling differs from the creature's).
export const BOSS_SPAWNS = {
  Geilhast: { npc: 'Gelihast' },
  'Ras Frostwhisperer': { npc: 'Ras Frostwhisper' },
  'Mutanus the Devourer': { npc: 'Naralex', note: 'Appears when Naralex wakes.' },
  'The Lost Dwarves': { npc: 'Baelog', note: 'Baelog, Eric and Olaf.' },
  'The Seven': { npc: "Doom'rel", note: "Doom'rel and the other six of the Seven." },
  Balnazzar: { npc: 'Grand Crusader Dathrohan', note: 'Grand Crusader Dathrohan becomes Balnazzar.' },
};
