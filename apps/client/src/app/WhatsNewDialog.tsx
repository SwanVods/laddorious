import { Dialog } from '../ui/Dialog';
import { CHANGELOG, parseChangelog } from './changelog';

const ENTRIES = parseChangelog(CHANGELOG);

/** What's new (the user, 2026-10-17): the changelog, newest release first. */
export function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="What's new" className="news-dialog" onClose={onClose}>
      <div className="news-list">
        {ENTRIES.map((entry) => (
          <section key={entry.version} className="news-entry">
            <div className="news-head">
              <h3 className="display">{`v${entry.version}`}</h3>
              <span className="news-date">{entry.date}</span>
            </div>
            <ul>
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
