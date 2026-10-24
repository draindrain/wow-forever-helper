// Shared constants for the data scripts.

// Forever client build on wago.tools (product "wowf"). Bump when a new build lands.
export const WAGO_BUILD = '1.60.1.70532';

export const CLASSES = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];

// slug on wowforevertalents.com, display name, kind
export const PROFESSIONS = [
  { slug: 'alchemy', name: 'Alchemy', kind: 'crafting' },
  { slug: 'blacksmithing', name: 'Blacksmithing', kind: 'crafting' },
  { slug: 'enchanting', name: 'Enchanting', kind: 'crafting' },
  { slug: 'engineering', name: 'Engineering', kind: 'crafting' },
  { slug: 'leatherworking', name: 'Leatherworking', kind: 'crafting' },
  { slug: 'tailoring', name: 'Tailoring', kind: 'crafting' },
  { slug: 'herbalism', name: 'Herbalism', kind: 'gathering' },
  { slug: 'mining', name: 'Mining', kind: 'gathering' },
  { slug: 'skinning', name: 'Skinning', kind: 'gathering' },
  { slug: 'cooking', name: 'Cooking', kind: 'secondary' },
  { slug: 'first-aid', name: 'First Aid', kind: 'secondary' },
  { slug: 'fishing', name: 'Fishing', kind: 'secondary' },
];

// Capital cities: quests there aren't a leveling area.
export const CITY_ZONE_IDS = [1519, 1537, 1638, 1637, 1657, 1497, 16509];

// Wowhead lists dev/test maps, seas and transport zones alongside real ones.
export const ZONE_EXCLUDE = /test|unused|prototype|sea$|waters|tram|crafting|tavern/i;

// Placeholder rows (<NYI>, <UNUSED>), Legacy reward pickups and similar aren't leveling quests.
export const NOT_A_QUEST = /^<|^Legacy Reward/;

// CMaNGOS classic-db world database, pinned to a commit: where Classic's creatures
// spawn, used for boss positions in the dungeons Forever keeps unchanged.
export const CMANGOS_DUMP =
  'https://raw.githubusercontent.com/cmangos/classic-db/2f5b31bc32e80f121d78656817fbc5d6c3b1e99c/Full_DB/ClassicDB_1_12_1_z2815.sql.gz';
