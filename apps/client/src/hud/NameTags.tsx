import type { PlayerId } from '@laddorious/core';
import type { CSSProperties } from 'react';
import type { TagRegistry } from '../scene/tags';
import type { SeatInfo } from '../service/matchService';
import type { RankBadge } from './ranks';

/**
 * In-world name tags (spec #2 §7.2): one per seat, in the seat colour, mine outlined in mint.
 * They start hidden; the scene's TagProjector places them over the pieces every frame. A tag
 * also carries its player's rank badge during the ranks reveal (polish spec §4.5).
 */
export function NameTags({
  seats,
  me,
  tags,
  ranks = {},
}: {
  seats: readonly SeatInfo[];
  me: PlayerId;
  tags: TagRegistry;
  ranks?: Readonly<Record<PlayerId, RankBadge>>;
}) {
  return (
    <div className="tags" aria-hidden="true">
      {seats.map((seat) => {
        const rank = ranks[seat.playerId];
        return (
          <div
            key={seat.playerId}
            ref={(el) => {
              if (el) tags.elements.set(seat.playerId, el);
              else tags.elements.delete(seat.playerId);
            }}
            className={seat.playerId === me ? 'tag me' : 'tag'}
            style={{ '--seat': seat.color, visibility: 'hidden' } as CSSProperties}
          >
            <div className="tag-stack">
              {rank && (
                <span className="rank-badge display" style={{ animationDelay: `${rank.delayMs}ms` }}>
                  {rank.label}
                </span>
              )}
              <span className="tag-name display">{seat.nickname}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
