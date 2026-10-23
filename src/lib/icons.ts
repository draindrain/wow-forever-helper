// Wowhead CDN icon names for things the data files don't carry an icon for.

const professionIcons: Record<string, string> = {
  alchemy: 'trade_alchemy',
  blacksmithing: 'trade_blacksmithing',
  enchanting: 'trade_engraving',
  engineering: 'trade_engineering',
  leatherworking: 'inv_misc_armorkit_17',
  tailoring: 'trade_tailoring',
  herbalism: 'trade_herbalism',
  mining: 'trade_mining',
  skinning: 'inv_misc_pelt_wolf_01',
  cooking: 'inv_misc_food_15',
  'first-aid': 'spell_holy_sealofsacrifice',
  fishing: 'trade_fishing',
};

export const professionIcon = (id: string) => professionIcons[id] ?? 'inv_misc_questionmark';
export const classIcon = (classId: string) => `class_${classId}`;
export const factionIcon = (faction: string) => (faction === 'Alliance' ? 'ui_allianceicon' : 'ui_hordeicon');
