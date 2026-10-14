import type { PlayerId, Ranking } from '@laddorious/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Director } from '../director/director';
import { BannerView, useBanner } from '../hud/Banner';
import { CardPickPopup } from '../hud/CardPickPopup';
import { useSound } from '../audio/SoundProvider';
import { useMatchSound } from '../audio/useMatchSound';
import { CenterDie } from '../hud/CenterDie';
import { useCardBubbles } from '../hud/bubbles';
import { rankBadges } from '../hud/ranks';
import { DevStats } from '../hud/DevStats';
import { Dock } from '../hud/Dock';
import { EventFeed } from '../hud/EventFeed';
import { FaceOffPopup } from '../hud/FaceOffPopup';
import { feedLines } from '../hud/feed';
import { nextRollMods, rejectionText } from '../hud/labels';
import { cardPickModel, countdown, dockModel, faceOffModel, playerRows, stageFromLog, stageIndex } from '../hud/model';
import { NameTags } from '../hud/NameTags';
import { presenceToast } from '../hud/presence';
import { PlayerColumn } from '../hud/PlayerColumn';
import { roundRecord } from '../hud/record';
import { StageBar } from '../hud/StageBar';
import { YourPiece } from '../hud/YourPiece';
import { MatchScene } from '../scene/MatchScene';
import type { QualitySetting } from '../scene/quality';
import { createTagRegistry } from '../scene/tags';
import type { MatchFailure, MatchSession } from '../service/matchService';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { ToastHost, showToast } from '../ui/toasts';
import { useHotkeys } from '../ui/useHotkeys';

/** How often the window countdown redraws. */
const TICK_MS = 250;

export interface MatchScreenProps {
  session: MatchSession;
  quality: QualitySetting;
  reducedMotion: boolean;
  /** The dev overlay: fps, draw calls, triangles (dev builds only). */
  showStats?: boolean;
  /** Beat lengths are multiplied by this (e2e builds). */
  timeScale?: number;
  /** Sound is muted; with onToggleMute, a speaker button toggles it (spec #3 §4). */
  muted?: boolean;
  onToggleMute?: () => void;
  /** I left through the leave dialog; the session has been left. */
  onLeave: () => void;
  /** The host failed (spec #2 §8): the error screen takes over. */
  onFailed: (failure: MatchFailure) => void;
  /** The victory has played: the end screen takes over. */
  onFinished: (rankings: Ranking[]) => void;
}

/**
 * The match screen (spec #2 §7.1, §7.2): the 3D board with the HUD over it. It plays the
 * session's updates through a Director and sends my rolls, picks and rerolls.
 */
export function MatchScreen({ session, quality, reducedMotion, showStats = false, timeScale = 1, muted = false, onToggleMute, onLeave, onFailed, onFinished }: MatchScreenProps) {
  const { me, seats } = session;
  const [director] = useState(() => new Director(me, (windowId) => session.playbackDone(windowId), undefined, timeScale));
  const [tags] = useState(createTagRegistry);
  const [watch, setWatch] = useState<PlayerId | null>(null);
  const [leaving, setLeaving] = useState(false);
  // The window I picked a card in: the pick closes at once, before the host's view catches up (polish spec §4.3).
  const [pickedWindow, setPickedWindow] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Who is away (spec #4 §3.3); the ref holds the last list so a change can be announced once.
  const [away, setAway] = useState<PlayerId[]>([]);
  const awayRef = useRef<PlayerId[]>([]);
  const sound = useSound();
  const handlersRef = useRef({ onFailed, onFinished });
  useLayoutEffect(() => {
    handlersRef.current = { onFailed, onFinished };
  });

  useEffect(() => {
    const offs = [
      session.onUpdate((u) => director.push(u)),
      session.onRejected((e) => {
        setPickedWindow(null); // a refused pick brings the cards back
        sound.playNow('U4');
        showToast(rejectionText(e.code));
      }),
      session.onFailed((e) => handlersRef.current.onFailed(e)),
      session.onPresence((next) => {
        const text = presenceToast(awayRef.current, next, session.seats, session.me);
        awayRef.current = next;
        setAway(next);
        if (text) showToast(text);
      }),
    ];
    return () => {
      for (const off of offs) off();
      director.dispose();
    };
  }, [session, director, sound]);

  const settled = useStore(director.store, (s) => s.settled);
  // The match's sounds, in time with the beats (spec #3 §5).
  useMatchSound(director, me, settled?.view.board.size ?? 100, timeScale);
  const presentation = useStore(director.store, (s) => s.presentation);
  const beat = useStore(director.store, (s) => s.beat);
  const log = useStore(director.store, (s) => s.log);
  const banner = useBanner(beat, me, seats);
  const record = useMemo(() => roundRecord(log), [log]);
  const lines = useMemo(() => feedLines(log), [log]);
  // Revealed cards as one-line bubbles beside their players' rows (polish spec §4.4).
  const shownBubbles = useCardBubbles(director, timeScale);
  const bubbles = useMemo(() => Object.fromEntries(Object.entries(shownBubbles).map(([id, b]) => [id, b.cardId])), [shownBubbles]);

  // The countdown redraws while a window's timer runs.
  const timer = settled?.timer ?? null;
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [timer]);

  // The end screen takes over once the victory beat has played (the update has settled).
  const rankings = settled?.view.phase.kind === 'finished' ? settled.view.phase.rankings : null;
  useEffect(() => {
    if (rankings) handlersRef.current.onFinished(rankings);
  }, [rankings]);

  const backToMine = () => setWatch(null);
  useHotkeys({ Escape: backToMine }, watch !== null && !leaving);

  const view = settled?.view;
  const rows = view && presentation ? playerRows({ view, presentation, record, seats, me, watch, away }) : [];
  const mine = rows.find((r) => r.me);
  const faceOff = view ? faceOffModel({ beat, view, me, nowMs: now }) : null;
  const cardPick = view && view.awaiting.windowId !== pickedWindow ? cardPickModel(view, beat) : null;
  // The card pick fans out (spec #3 §5).
  const pickWindow = cardPick ? (view?.awaiting.windowId ?? null) : null;
  useEffect(() => {
    if (pickWindow !== null) sound.playNow('C1');
  }, [pickWindow, sound]);
  const watched = seats.find((s) => s.playerId === watch);

  const leave = () => {
    setLeaving(false);
    director.dispose();
    session.leave();
    onLeave();
  };

  return (
    <div className="screen match">
      <MatchScene key={quality} director={director} seats={seats} me={me} setting={quality} watch={watch} reducedMotion={reducedMotion} showStats={showStats} tags={tags} />
      <div className="layer">
        <NameTags seats={seats} me={me} tags={tags} ranks={rankBadges(beat, timeScale)} />
        {view && presentation && (
          <>
            <StageBar round={presentation.round} stage={stageIndex(beat, view.awaiting.window, stageFromLog(log))} timer={countdown(settled.timer, view.awaiting.durationMs, now)} />
            <EventFeed lines={lines} seats={seats} />
            <PlayerColumn rows={rows} bubbles={bubbles} onWatch={setWatch} reducedMotion={reducedMotion} />
            {mine && <YourPiece row={mine} mods={nextRollMods(presentation.effects, me)} players={rows.length} boardSize={view.board.size} />}
            <Dock model={dockModel({ beat, view, record, me })} seats={seats} onRoll={() => session.send({ type: 'roll' })} />
          </>
        )}
        {watched && (
          <div className="watch-pill pill live">
            <Icon name="eye" />
            <span>
              Watching <b>{watched.nickname}</b>
            </span>
            <button type="button" className="btn" onClick={backToMine}>
              Back to my piece
            </button>
          </div>
        )}
        {away.includes(me) && (
          <div className="reconnect-pill pill live" role="status" aria-live="polite">
            <span className="spinner" />
            Reconnecting…
          </div>
        )}
        {onToggleMute && (
          <button type="button" className="round-btn sound-btn live" aria-label={muted ? 'Turn sound on' : 'Mute sound'} data-sound="U3" data-sound-arg={muted ? 1 : 0} onClick={onToggleMute}>
            <Icon name={muted ? 'speaker-off' : 'speaker'} />
          </button>
        )}
        <button type="button" className="round-btn menu-btn live" aria-label="Leave match" onClick={() => setLeaving(true)}>
          <Icon name="menu" />
        </button>
        {showStats && <DevStats />}
        <CenterDie director={director} me={me} reducedMotion={reducedMotion} timeScale={timeScale} />
        <BannerView banner={banner} />
        {faceOff && <FaceOffPopup model={faceOff} seats={seats} me={me} onPick={(choice) => session.send({ type: 'challengePick', challengeId: faceOff.challengeId, choice })} />}
        {cardPick && view && (
          <CardPickPopup
            model={cardPick}
            onPick={(slot) => {
              setPickedWindow(view.awaiting.windowId);
              session.send({ type: 'pickCard', slot });
            }}
            onReroll={(slot) => session.send({ type: 'reroll', slot })}
          />
        )}
        {leaving && (
          <Dialog title="Leave match?" onClose={() => setLeaving(false)}>
            <p className="dialog-text">
              {seats.some((s) => !s.bot && s.playerId !== me)
                ? 'You go back to the menu. The match carries on without you.'
                : 'Leaving ends this match against the bots and takes you back to the menu.'}
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setLeaving(false)}>
                Keep playing
              </button>
              <button type="button" className="btn accent" onClick={leave}>
                Leave
              </button>
            </div>
          </Dialog>
        )}
        <ToastHost />
      </div>
    </div>
  );
}
