import type { PlayerId } from '@laddorious/core';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';
import { CardChip, DiceChips, EffectChipView, MysteryChip, RARITY_NAMES, RESULT_NAMES } from './Chips';
import { PIECE_NAMES, cardInfo } from './labels';
import type { PlayerRow, RowStatus } from './model';

/** A press this long opens a row's details card instead of watching (spec #2 §7.2). */
export const LONG_PRESS_MS = 500;
/** How long a re-sorted row takes to slide to its new place. */
const RESORT_MS = 450;

const STATUS_ICON: Record<Exclude<RowStatus, 'waiting' | 'idle'>, 'bolt' | 'check' | 'lock'> = { turn: 'bolt', done: 'check', locked: 'lock' };

/** A player with nothing to do shows no icon (2026-10-14); the old eye read as nothing in particular. */
function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'idle') return null;
  return <span className={`prow-status ${status}`}>{status === 'waiting' ? <span className="spinner" /> : <Icon name={STATUS_ICON[status]} />}</span>;
}

const isMouse = (e: ReactPointerEvent) => e.pointerType !== 'touch' && e.pointerType !== 'pen';
const nameOf = (row: PlayerRow) => (row.me ? `${row.seat.nickname} (you)` : row.seat.nickname);

/** Everything about one player, for a long press or a mouse hover (spec #2 §7.2). */
function Details({ row, players }: { row: PlayerRow; players: number }) {
  const card = row.card;
  return (
    <div className="pdetail panel" role="note" aria-label={row.seat.nickname}>
      <span className="pdetail-name display">{row.seat.nickname}</span>
      <span className="pdetail-sub">{`${PIECE_NAMES[row.seat.piece]} · tile ${row.tile} · rank ${row.rank} of ${players}`}</span>
      <div className="pdetail-row">
        <span className="pdetail-key">Dice</span>
        {row.dice ? (
          <>
            <DiceChips dice={{ ...row.dice, total: null }} />
            {row.dice.total !== null && <span>{`Moves ${row.dice.total}`}</span>}
          </>
        ) : (
          <span className="pdetail-none">Not rolled yet</span>
        )}
      </div>
      <div className="pdetail-row">
        <span className="pdetail-key">Now</span>
        {row.statusText}
      </div>
      {row.mystery && (
        <div className="pdetail-row">
          <span className="pdetail-key">Square</span>
          <MysteryChip rarity={row.mystery} />
          {`${RARITY_NAMES[row.mystery]} ?, picks a card this round`}
        </div>
      )}
      <span className="pdetail-key">Effects</span>
      {row.effects.length > 0 ? (
        row.effects.map((chip) => (
          <div key={chip.id} className="pdetail-fx">
            <EffectChipView chip={chip} />
            <span>
              <b>{chip.name}</b> {`${chip.description}. ${chip.life}.`}
            </span>
          </div>
        ))
      ) : (
        <div className="pdetail-none">None</div>
      )}
      {card && <span className="pdetail-key">Card</span>}
      {card === 'facedown' && <div className="pdetail-none">Picked a card. It stays hidden until everyone has picked.</div>}
      {card && card !== 'facedown' && (
        <div className="pdetail-fx">
          <CardChip card={card} />
          <span>
            <b>{cardInfo(card.cardId).name}</b> {cardInfo(card.cardId).text}
            {card.result && <b>{` ${RESULT_NAMES[card.result]}`}</b>}
          </span>
        </div>
      )}
    </div>
  );
}

/** A revealed card in one line beside its player's row (polish pass): icon, name, summary. */
function CardBubble({ cardId }: { cardId: string }) {
  const info = cardInfo(cardId);
  return (
    <div className={`pbubble ${info.rarity} ${info.type}`} aria-hidden="true">
      <span className="pbubble-medal">
        <Icon name={info.icon} />
      </span>
      <b className="pbubble-name display">{info.name}</b>
      <span className="pbubble-summary">{info.summary}</span>
    </div>
  );
}

interface PlayerColumnProps {
  rows: PlayerRow[];
  /** Revealed cards by player, shown as one-line bubbles beside their rows. */
  bubbles?: Readonly<Record<PlayerId, string>>;
  /** Watch a piece, or null to go back to my own (spec #2 §5.3). */
  onWatch: (player: PlayerId | null) => void;
  reducedMotion: boolean;
}

/**
 * The TFT-style player column on the right edge (spec #2 §7.2): front-runner first, each row
 * with a status icon, a name plate with the tile, a mini row of dice and chips, and a portrait
 * with the rank. Tap watches that piece; a long press or a mouse hover opens the details card.
 */
export function PlayerColumn({ rows, bubbles = {}, onWatch, reducedMotion }: PlayerColumnProps) {
  const [detail, setDetail] = useState<{ id: PlayerId; by: 'press' | 'hover' } | null>(null);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const itemsRef = useRef(new Map<PlayerId, HTMLLIElement>());
  const topsRef = useRef(new Map<PlayerId, number>());
  const order = rows.map((r) => r.seat.playerId).join(' ');

  useEffect(() => () => {
    if (pressRef.current.timer !== null) clearTimeout(pressRef.current.timer);
  }, []);

  // Rows that change place slide there from where they were (FLIP), unless motion is reduced.
  useLayoutEffect(() => {
    for (const [id, el] of itemsRef.current) {
      const top = el.offsetTop;
      const before = topsRef.current.get(id);
      topsRef.current.set(id, top);
      if (reducedMotion || before === undefined || before === top || typeof el.animate !== 'function') continue;
      el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: RESORT_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1.1)' });
    }
  }, [order, reducedMotion]);

  const stopPress = () => {
    if (pressRef.current.timer !== null) clearTimeout(pressRef.current.timer);
    pressRef.current.timer = null;
  };

  return (
    <ol className="players live" aria-label="Players">
      {rows.map((row) => {
        const id = row.seat.playerId;
        const classes = ['prow', row.me ? 'me' : '', row.watched ? 'watched' : '', row.rank === 1 ? 'first' : '', row.away ? 'away' : ''].filter(Boolean).join(' ');
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) itemsRef.current.set(id, el);
              else itemsRef.current.delete(id);
            }}
          >
            <button
              type="button"
              className={classes}
              aria-label={`${nameOf(row)}, tile ${row.tile}, rank ${row.rank}${row.away ? ', away' : ''}. ${row.statusText}`}
              onPointerDown={() => {
                stopPress();
                pressRef.current.fired = false;
                pressRef.current.timer = setTimeout(() => {
                  pressRef.current.timer = null;
                  pressRef.current.fired = true;
                  setDetail({ id, by: 'press' });
                }, LONG_PRESS_MS);
              }}
              onPointerUp={stopPress}
              onPointerCancel={stopPress}
              onPointerEnter={(e) => {
                if (isMouse(e)) setDetail({ id, by: 'hover' });
              }}
              onPointerLeave={(e) => {
                stopPress();
                if (isMouse(e)) setDetail((d) => (d?.id === id && d.by === 'hover' ? null : d));
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (pressRef.current.fired) {
                  pressRef.current.fired = false;
                  return;
                }
                if (detail?.by === 'press') {
                  setDetail(null);
                  return;
                }
                onWatch(row.me || row.watched ? null : id);
              }}
            >
              <StatusIcon status={row.status} />
              <span className="prow-plate">
                <span className="prow-name display">
                  {row.seat.nickname}
                  <span className="prow-tile">{row.tile}</span>
                  {row.away && <span className="prow-away">Away</span>}
                </span>
                <span className="prow-mini">
                  {row.dice && <DiceChips dice={row.dice} />}
                  {row.mystery && <MysteryChip rarity={row.mystery} />}
                  {row.effects.map((chip) => (
                    <EffectChipView key={chip.id} chip={chip} />
                  ))}
                  {row.card && <CardChip card={row.card} />}
                </span>
              </span>
              <Portrait piece={row.seat.piece} color={row.seat.color} badge={row.rank} />
            </button>
            {detail?.id === id ? <Details row={row} players={rows.length} /> : bubbles[id] && <CardBubble cardId={bubbles[id]} />}
          </li>
        );
      })}
    </ol>
  );
}
