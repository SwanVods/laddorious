import type { CSSProperties } from 'react';
import type { SeatInfo } from '../service/matchService';
import type { FeedPart } from './feed';

/** Feed-style text: plain strings, and players' nicknames drawn in their seat colour. */
export function Parts({ parts, seats }: { parts: readonly FeedPart[]; seats: readonly SeatInfo[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return part;
        const seat = seats.find((s) => s.playerId === part.player);
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- parts never reorder
          <b key={i} className="who" style={seat ? ({ '--seat': seat.color } as CSSProperties) : undefined}>
            {seat?.nickname ?? part.player}
          </b>
        );
      })}
    </>
  );
}
