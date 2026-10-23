# WoW Forever Helper

A second-screen leveling cheat sheet for **World of Warcraft: Forever**. Create your character (race, class,
spec and trade skills), bump the level each time you ding, and the page shows what matters at that level:

- **New at this level**: trainer spells and ranks, with your spec's spells highlighted, plus talent points,
  gear unlocks (plate, dual wield…), dungeon and battleground unlocks, and Forever milestones like dual spec at 40.
- **Coming up**: everything unlocking over the next six levels, so you know when a trainer visit is worth it.
- **Where to quest**: zones for your faction around your level, with how many quests sit at your level and which
  herbs and veins you can gather there.
- **Dungeons**: instances in range, coloured by difficulty, with entry level, group size and bosses.
- **Trade skills**: track your skill, see when the next rank unlocks, the recipes that give skill-ups right now
  and what unlocks soon. Mining and Herbalism list the nodes you can gather; Skinning shows the highest level you
  can skin.
- **Spellbook**: every spell you have at your level by school, with tooltips.

Several characters can be saved; they live in your browser's local storage. The `+` and `-` keys change level.

## Data

Everything is WoW Forever data from the beta client (build `1.60.1.70532`), not Classic:

| What | Source |
| --- | --- |
| Class spells, ranks and levels; racials; recipes; dungeon entry levels and bosses | Read from the Forever client by [wowforevertalents.com](https://wowforevertalents.com/) |
| Race/class combinations | Forever client tables via [wago.tools](https://wago.tools/) |
| Zone quest levels and gathering nodes | [Wowhead's Forever database](https://www.wowhead.com/forever) |
| Dungeon level ranges, launch raids, dual spec and other milestones | Blizzard announcements, via [warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/World_of_Warcraft:_Forever) |

Caveats:

- The beta stopped at level 30. Spells and dungeons above 30 come from the client data, so expect changes at
  launch. The site flags this when you go past 30.
- Zone ranges are the middle 80% of a zone's quest levels for your faction. Riverglades and Mount Hyjal have too
  few catalogued quests so far, so they use Wowhead's zone range and Blizzard's level 60.
- Trainers keep their requirements on the server. Profession rank levels other than Journeyman (10), the
  Apprentice Riding level, and the skill for trainer-taught recipes are Classic values or estimates. The site
  marks them as unconfirmed.

## Development

Requires Node 22.12+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and build to dist/
```

The app is Vite + React + TypeScript. Generated data lives in `src/data/generated/` and is committed, so
building the site never touches the network.

### Refreshing the data

When a new Forever build lands (or after launch):

1. Bump `WAGO_BUILD` in `scripts/sources.mjs` if the client build changed.
2. `npm run data:fetch -- --force` re-downloads everything into `data-raw/` (git-ignored). Wowhead pages are
   rendered in headless Chrome through `playwright-core`; set `CHROMIUM_PATH` if Chrome/Chromium isn't found.
   Add `--only=wft,wago,wowhead` to fetch a subset. Without `--force`, files already downloaded are kept.
3. `npm run data:build` turns `data-raw/` into `src/data/generated/`. (`npm run data` runs both steps.)
4. Facts that aren't in any machine-readable source (dungeon ranges, milestones, profession rank levels, zone
   notes) are in `scripts/curated.mjs`, each with its source. Update them as Blizzard confirms things.

## Deployment

`.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages on every push to `main`
(pull requests only build). One-time setup: in the repository's **Settings → Pages**, set **Source** to
**GitHub Actions**.

---

Fan-made and unofficial. World of Warcraft is a trademark of Blizzard Entertainment, Inc. Icons are served from
Wowhead's CDN.
