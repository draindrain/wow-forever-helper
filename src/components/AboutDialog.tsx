import { useEffect, useRef } from 'react';
import { BETA_LEVEL_CAP, meta } from '../data';

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="about-dialog panel"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <header className="panel-title">
        <h2>About WoW Forever Helper</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="panel-body about-body">
        <p>
          A second-screen cheat sheet for World of Warcraft: Forever. Everything fits on one 1080p screen; the tabs hold
          the details. Your characters are saved in this browser only.
        </p>
        <h4>Shortcuts</h4>
        <p>
          <kbd>+</kbd> / <kbd>−</kbd> change level · <kbd>1</kbd>–<kbd>4</kbd> switch tabs · hover an icon for its
          tooltip.
        </p>
        <h4>Where the data comes from</h4>
        <ul>
          <li>
            Spells, ranks, racials, recipes and dungeon bosses: read from the Forever beta client (build{' '}
            {meta.clientBuild}) by <a href="https://wowforevertalents.com/">wowforevertalents.com</a>.
          </li>
          <li>
            Race and class combinations: client tables via <a href="https://wago.tools/">wago.tools</a>.
          </li>
          <li>
            Zone quest levels and gathering nodes:{' '}
            <a href="https://www.wowhead.com/forever">Wowhead's Forever database</a>. A zone's range is the middle 80%
            of its quest levels for your faction.
          </li>
          <li>
            Dungeon level ranges, raids, dual spec and other milestones: Blizzard's announcements, via{' '}
            <a href="https://warcraft.wiki.gg/wiki/World_of_Warcraft:_Forever">warcraft.wiki.gg</a>.
          </li>
        </ul>
        <h4>Caveats</h4>
        <ul>
          <li>The beta stopped at level {BETA_LEVEL_CAP}; anything above it is client data nobody has played yet.</li>
          <li>
            Trainers keep their requirements on the server. Values marked "Classic" or "unconfirmed", and recipe skills
            marked "~", are estimates until Forever confirms them.
          </li>
        </ul>
        <p className="small muted">
          Data updated {meta.generatedAt}. Fan-made and unofficial. World of Warcraft is a trademark of Blizzard
          Entertainment, Inc. Icons via Wowhead.
        </p>
      </div>
    </dialog>
  );
}
