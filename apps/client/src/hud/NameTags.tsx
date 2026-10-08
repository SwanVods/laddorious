import type { PlayerId } from '@laddorious/core';
import type { CSSProperties } from 'react';
import type { TagRegistry } from '../scene/tags';
import type { SeatInfo } from '../service/matchService';

/**
 * In-world name tags (spec #2 §7.2): one per seat, in the seat colour, mine outlined in mint.
 * They start hidden; the scene's TagProjector places them over the pieces every frame.
 */
export function NameTags({ seats, me, tags }: { seats: readonly SeatInfo[]; me: PlayerId; tags: TagRegistry }) {
  return (
    <div className="tags" aria-hidden="true">
      {seats.map((seat) => (
        <div
          key={seat.playerId}
          ref={(el) => {
            if (el) tags.elements.set(seat.playerId, el);
            else tags.elements.delete(seat.playerId);
          }}
          className={seat.playerId === me ? 'tag me' : 'tag'}
          style={{ '--seat': seat.color, visibility: 'hidden' } as CSSProperties}
        >
          <span className="tag-name display">{seat.nickname}</span>
        </div>
      ))}
    </div>
  );
}
