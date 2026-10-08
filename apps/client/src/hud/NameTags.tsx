import type { PlayerId } from '@laddorious/core';
import type { CSSProperties } from 'react';
import type { TagRegistry } from '../scene/tags';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { cardInfo } from './labels';

/** A revealed card shown over its caster (polish spec §4.4); `level` lifts it above bubbles lower on the same tile. */
export interface TagBubble {
  cardId: string;
  level: number;
}

/**
 * In-world name tags (spec #2 §7.2): one per seat, in the seat colour, mine outlined in mint.
 * They start hidden; the scene's TagProjector places them over the pieces every frame. A tag
 * also carries its player's card bubble while one is up.
 */
export function NameTags({ seats, me, tags, bubbles = {} }: { seats: readonly SeatInfo[]; me: PlayerId; tags: TagRegistry; bubbles?: Readonly<Record<PlayerId, TagBubble>> }) {
  return (
    <div className="tags" aria-hidden="true">
      {seats.map((seat) => {
        const bubble = bubbles[seat.playerId];
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
              {bubble && <CardBubble {...bubble} />}
              <span className="tag-name display">{seat.nickname}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardBubble({ cardId, level }: TagBubble) {
  const info = cardInfo(cardId);
  return (
    <div className={`bubble ${info.rarity} ${info.type}`} style={{ '--level': level } as CSSProperties}>
      <span className="bubble-medal">
        <Icon name={info.icon} />
      </span>
      <span className="bubble-body">
        <b className="bubble-name display">{info.name}</b>
        <span className="bubble-text">{info.text}</span>
        <span className="bubble-target">
          <Icon name="target" />
          {info.targetLine}
        </span>
      </span>
    </div>
  );
}
