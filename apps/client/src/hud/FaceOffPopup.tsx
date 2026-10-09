import type { ChallengeChoice, PlayerId } from '@laddorious/core';
import { Fragment, useId, useState } from 'react';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';
import { useHotkeys } from '../ui/useHotkeys';
import { KNOCKBACK, type FaceOffModel, type Fighter } from './model';

interface FaceOffPopupProps {
  model: FaceOffModel;
  seats: readonly SeatInfo[];
  me: PlayerId;
  onPick: (choice: ChallengeChoice) => void;
}

const RPS = new Set<ChallengeChoice>(['rock', 'paper', 'scissors']);

/**
 * The face-off (spec #2 §7.2, C11): centred over a dimmed board, no panel, only for its players.
 * Portraits with lock states and revealed picks; Rock / Paper / Scissors, or the Minority
 * theme's two choices. Tap a choice or press 1–3; one pick per pick round.
 */
export function FaceOffPopup({ model, seats, me, onPick }: FaceOffPopupProps) {
  const titleId = useId();
  const round = `${model.challengeId}:${model.pickRound}`;
  const [sentIn, setSentIn] = useState<string | null>(null);
  const canPick = model.canPick && sentIn !== round;
  const pick = (choice: ChallengeChoice) => {
    if (!canPick) return;
    setSentIn(round);
    onPick(choice);
  };
  useHotkeys(Object.fromEntries(model.choices.map((c, i) => [String(i + 1), () => pick(c.choice)])), canPick);

  const seat = (id: PlayerId) => seats.find((s) => s.playerId === id);
  const labelOf = (choice: ChallengeChoice | null) => model.choices.find((c) => c.choice === choice)?.label ?? 'No pick';
  const sent = sentIn === round || model.myPick !== null;
  const stateOf = (f: Fighter): string => {
    if (model.result) return labelOf(f.pick);
    if (f.out) return 'Out';
    if (f.locked || (f.player === me && sent)) return 'Pick locked';
    if (f.player === me) return canPick ? 'Your pick' : 'Get ready…';
    return 'Picking…';
  };
  const winner = model.result?.winner ?? null;
  const hint = model.result
    ? winner === null
      ? 'A tie! The face-off goes again.'
      : `${winner === me ? 'You win' : `${seat(winner)?.nickname ?? winner} wins`} the face-off. The loser is knocked back ${KNOCKBACK}.`
    : canPick
      ? 'Only the players in this face-off see this. Picks stay secret until everyone has locked. No pick in time counts as a loss.'
      : sent
        ? 'Waiting for the reveal…'
        : 'Get ready to pick…';

  return (
    <div className="popup live" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="backdrop" />
      <div className="popup-content">
        <h2 id={titleId} className="popup-title display">
          FACE-OFF!
        </h2>
        <p className="popup-sub">
          {`Tile ${model.tile} · ${model.kind === 'rps' ? 'Rock paper scissors' : 'Minority: the odd one out wins'} · pick round ${model.pickRound} · the loser is knocked back ${KNOCKBACK}`}
        </p>
        <div className="fighters">
          {model.fighters.map((f, i) => {
            const s = seat(f.player);
            const state = stateOf(f);
            return (
              <Fragment key={f.player}>
                {i > 0 && model.fighters.length === 2 && <span className="vs display">VS</span>}
                <div
                  className={['fighter', f.player === me ? 'me' : '', f.out ? 'out' : '', winner === f.player ? 'winner' : ''].filter(Boolean).join(' ')}
                  role="group"
                  aria-label={`${s?.nickname ?? f.player}: ${state}`}
                >
                  {s && <Portrait piece={s.piece} color={s.color} className="fighter-portrait" />}
                  {model.result && f.pick && (
                    <span className="fighter-pick">{RPS.has(f.pick) ? <Icon name={f.pick as 'rock' | 'paper' | 'scissors'} /> : <b className="display">{labelOf(f.pick)}</b>}</span>
                  )}
                  <span className="fighter-name display">{s?.nickname ?? f.player}</span>
                  <span className="fighter-state">
                    {state === 'Pick locked' && <Icon name="lock" />}
                    {state}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="choices">
          {model.choices.map((c, i) => (
            <button key={c.choice} type="button" className={model.myPick === c.choice ? 'choice on' : 'choice'} data-sound="F2" disabled={!canPick} onClick={() => pick(c.choice)}>
              <kbd>{i + 1}</kbd>
              {RPS.has(c.choice) && <Icon name={c.choice as 'rock' | 'paper' | 'scissors'} />}
              <span className="display">{c.label}</span>
            </button>
          ))}
        </div>
        <p className="popup-hint">{hint}</p>
      </div>
    </div>
  );
}
