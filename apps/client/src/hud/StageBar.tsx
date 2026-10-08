import { Icon } from '../ui/Icon';
import { STAGES } from './model';

/** Seconds left at which the timer bar turns to the accent colour. */
export const TIMER_LOW_S = 3;

/**
 * Top centre, one row (spec #2 §7.2): ROUND n, an icon per stage (past ones done, the current
 * one named), then the open window's timer.
 */
export function StageBar({ round, stage, timer }: { round: number; stage: number | null; timer: { seconds: number; fraction: number } | null }) {
  return (
    <div className="stage-bar">
      <span className="stage-round display">
        ROUND <b>{round}</b>
      </span>
      <span className="stage-sep" />
      <ol className="stage-steps" aria-label="Stages of the round">
        {STAGES.map((s, i) => {
          const state = stage === null || i > stage ? 'next' : i < stage ? 'done' : 'now';
          return (
            <li key={s.id} className={state} aria-label={s.label} aria-current={state === 'now' ? 'step' : undefined}>
              <Icon name={s.icon} />
              <span className="display" aria-hidden="true">
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {timer && (
        <>
          <span className="stage-sep" />
          <div className="stage-timer" role="timer" aria-label={`${timer.seconds} seconds left`}>
            <div className={timer.seconds <= TIMER_LOW_S ? 'stage-tbar low' : 'stage-tbar'}>
              <i style={{ width: `${(timer.fraction * 100).toFixed(1)}%` }} />
            </div>
            <span className="display">{`${timer.seconds}s`}</span>
          </div>
        </>
      )}
    </div>
  );
}
