import type { SeatInfo } from '../service/matchService';
import type { FeedLine } from './feed';
import { Parts } from './Parts';

/** Top left (spec #2 §7.2): the newest lines first; private ones are dashed. Phones show 3. */
export function EventFeed({ lines, seats }: { lines: readonly FeedLine[]; seats: readonly SeatInfo[] }) {
  return (
    <ol className="feed" aria-label="What just happened" aria-live="polite">
      {lines.map((line) => (
        <li key={line.seq} className={line.private ? 'feed-line private' : 'feed-line'}>
          <Parts parts={line.parts} seats={seats} />
        </li>
      ))}
    </ol>
  );
}
