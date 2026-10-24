# WoW Forever Helper

A second-screen leveling cheat sheet for **World of Warcraft: Forever**. Create your character (race, class,
spec and trade skills), bump the level each time you ding, and the page shows what matters at that level.

It's built to sit on a second monitor while you play: on a 1080p screen everything fits without scrolling.
Every list shows as many rows as fit and ends in "+N more" instead of running off the screen. Four tabs hold
the details:

- **Overview** (the default) packs in as much as fits: what's new at your trainer this level, what unlocks
  over the next levels, where to quest, dungeons in range, and your trade skills with their best skill-ups.
- **Class skills**: new and upcoming trainer spells, your spellbook with one column per talent tree (your
  spec's first), plus racials, talent milestones (dual spec at 40, spec talents) and gear unlocks.
- **Quests & dungeons**: zones for your faction around your level with how many quests sit at your level, the
  herbs and veins you can gather there, and the next zones coming up; dungeons in range with entry level and
  bosses; later dungeons; battlegrounds and raids.
- **Trade skills**: one column per profession. Track your skill, see when the next rank unlocks, the recipes
  that give skill-ups now and what unlocks soon. Mining and Herbalism also list the nodes you can gather and
  where; Skinning shows the highest level you can skin.

Click any zone or dungeon for its quests. A zone opens with its map: every quest giver is pinned as a `!`
(pick up) or `?` (turn in) coloured by difficulty for you, and hovering a quest lights up its pins. Each quest
shows its level, objective, where to pick it up and hand it in (with coordinates), its rewards (XP, money,
reputation and items) and, for chains, every step in order. Dungeons and raids list their quests plus any key
or attunement chain; on the Classic dungeons Forever keeps, the map shows a numbered pin for each boss.
Hover a spell, talent, racial, recipe or reward item for its tooltip.

Several characters can be saved; they live in your browser's local storage. Keyboard: `+` / `-` change
level, `1`–`4` switch tabs. On windows smaller than about 1100×600 (phones, small laptops) the page falls back
to a normal scrolling layout.

## Data

Everything is WoW Forever data from the beta client (build `1.60.1.70532`), not Classic:

| What | Source |
| --- | --- |
| Class spells, ranks and levels; racials; recipes; dungeon entry levels | Read from the Forever client by [wowforevertalents.com](https://wowforevertalents.com/) |
| Race/class combinations; dungeon bosses | Forever client tables via [wago.tools](https://wago.tools/) |
| Zone quest levels and gathering nodes | [Wowhead's Forever database](https://www.wowhead.com/forever) |
| Quests: givers, coordinates, chains and rewards; zone maps; item tooltips | [Wowhead's Forever database](https://www.wowhead.com/forever) (quest pages, map images and its tooltip API) |
| Boss positions on dungeon maps | Classic's creature spawns from [CMaNGOS classic-db](https://github.com/cmangos/classic-db), fitted onto Wowhead's map images |
| Dungeon level ranges, launch raids, dual spec and other milestones | Blizzard announcements, via [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/World_of_Warcraft:_Forever) |

Caveats:

- The beta stopped at level 30. Spells and dungeons above 30 come from the client data, so expect changes at
  launch. The site flags this when you go past 30.
- Zone ranges are the middle 80% of a zone's quest levels for your faction. Riverglades and Mount Hyjal have too
  few catalogued quests so far, so they use Wowhead's zone range and Blizzard's level 60.
- Keys and attunements (Onyxia's Lair, Scholomance, Blackrock Depths, Maraudon) follow Classic and are listed
  only when their quests exist in Forever's data.
- Boss pins assume Forever's Classic dungeons are unchanged. Wowhead's map images aren't the game's map
  textures, so each one is matched to Classic's spawn positions by fitting and was checked by eye. Fourteen
  dungeons line up; Deadmines, Shadowfang Keep, Scarlet Monastery and Zul'Farrak don't, Lower Blackrock Spire
  has no map, and Forever's new dungeons have no Classic data, so those show their boss list only. Bosses that
  only appear through an event (Timmy the Cruel, Kirtonos) have no fixed spot.
- Trainers keep their requirements on the server. Profession rank levels other than Journeyman (10), the
  Apprentice Riding level, and the skill for trainer-taught recipes are Classic values or estimates. The site
  marks them as unconfirmed.

## Development

Requires Node 22.12+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and build to dist/
npm run format     # Prettier for src/
```

The app is Vite + React + TypeScript. Generated data lives in `src/data/generated/` and is committed, so
building the site never touches the network.

### Refreshing the data

When a new Forever build lands (or after launch):

1. Bump `WAGO_BUILD` in `scripts/sources.mjs` if the client build changed.
2. `npm run data:fetch -- --force` re-downloads everything into `data-raw/` (git-ignored). Wowhead pages are
   rendered in headless Chrome through `playwright-core`; set `CHROMIUM_PATH` if Chrome/Chromium isn't found.
   Add `--only=wft,wago,wowhead,quests,items` to fetch a subset. Without `--force`, files already downloaded
   are kept. `quests` renders every quest page in the zone and dungeon lists (about 3,000; it takes an hour or
   so and restarts its browser whenever Wowhead's bot check starts timing out), so run it after `wowhead`;
   `items` then fetches tooltips for reward and crafted items; `cmangos` downloads Classic's spawn database for
   boss positions.
3. `npm run data:build` turns `data-raw/` into `src/data/generated/`. (`npm run data` runs both steps.)
4. Only if Wowhead's dungeon map images change: `node scripts/fit-dungeon-maps.mjs` refits them into
   `scripts/dungeon-maps.json` and writes previews to `data-raw/maps/`. Check each preview by eye before listing
   its map in `PINNED_MAPS` (`scripts/curated.mjs`).
5. Facts that aren't in any machine-readable source (dungeon ranges, milestones, profession rank levels, zone
   notes) are in `scripts/curated.mjs`, each with its source. Update them as Blizzard confirms things.

## Deployment

`.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages on every push to `main`
(pull requests only build). One-time setup: in the repository's **Settings → Pages**, set **Source** to
**GitHub Actions**.

---

Fan-made and unofficial. World of Warcraft is a trademark of Blizzard Entertainment, Inc. Icons are served from
Wowhead's CDN.
