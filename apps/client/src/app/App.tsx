import type { Ranking } from '@laddorious/core';
import { Component, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { useSound } from '../audio/SoundProvider';
import type { FindOptions, Matchmaking, MatchService, MatchSession } from '../service/matchService';
import { RotateScreen } from '../ui/RotateScreen';
import { ToastHost, showToast } from '../ui/toasts';
import { EndScreen } from './EndScreen';
import { ErrorScreen } from './ErrorScreen';
import { LoadingScreen } from './LoadingScreen';
import { wantsFullscreen } from './fullscreen';
import { MatchmakingOverlay } from './MatchmakingOverlay';
import { MatchScreen } from './MatchScreen';
import { MenuScreen } from './MenuScreen';
import type { PrefsState } from './prefs';
import { SettingsDialog } from './SettingsDialog';
import type { TestHooks } from './testMode';

/** Where the player is (spec #2 §4.1): the screens and what each one holds. */
type Route =
  | { screen: 'menu' }
  | { screen: 'matchmaking'; matchmaking: Matchmaking }
  | { screen: 'match'; session: MatchSession }
  | { screen: 'end'; session: MatchSession; rankings: Ranking[] }
  | { screen: 'error'; message: string };

interface AppProps {
  service: MatchService;
  /** Online builds: the offline bots, offered when the server can't be reached (spec #4 §3.3). */
  offline?: MatchService;
  /** Online builds: a match rejoined after a reload; the app starts in it (spec #4 §3.3). */
  resume?: MatchSession | null;
  prefs: StoreApi<PrefsState>;
  /** Dev builds: the seed field, the stats overlay and error details. */
  dev: boolean;
  /** e2e builds: fast matches, and the render stats for the draw-call check (spec #2 §9.3). */
  test?: TestHooks | null;
}

/**
 * The app shell (spec #2 §4.1, §7.1): menu → matchmaking (over the menu scene) → match → end
 * (over the dimmed board), plus the error screen, the settings dialog and the rotate screen.
 * It pauses a local match while the page is hidden (C14) and asks for fullscreen on the first
 * touch where the browser allows it (§7.3).
 */
export function App({ service, offline, resume = null, prefs, dev, test = null }: AppProps) {
  const [route, setRoute] = useState<Route>(() => (resume ? { screen: 'match', session: resume } : { screen: 'menu' }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [crashes, setCrashes] = useState(0);
  const settings = useStore(prefs, (s) => s.settings);
  const tappedRef = useRef(false);

  // A hidden page pauses the local match, and it resumes on return (C14).
  const playing = route.screen === 'match' ? route.session : null;
  useEffect(() => {
    if (!playing) return;
    const onVisibility = () => (document.hidden ? playing.pause() : playing.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playing]);

  // The music follows the screen (spec #3 §6); the win fades it out, and the end screen stays quiet.
  const sound = useSound();
  useEffect(() => {
    sound.music(route.screen === 'menu' || route.screen === 'matchmaking' ? 'menu' : route.screen === 'match' ? 'match' : null);
  }, [route.screen, sound]);

  const toMenu = () => setRoute({ screen: 'menu' });
  const play = (opts: FindOptions = {}) => setRoute({ screen: 'matchmaking', matchmaking: service.findMatch(prefs.getState().profile, opts) });
  const playOffline = () => {
    if (!offline) return;
    const matchmaking = offline.findMatch(prefs.getState().profile);
    matchmaking.playWithBots();
    setRoute({ screen: 'matchmaking', matchmaking });
  };
  const session = route.screen === 'match' || route.screen === 'end' ? route.session : null;

  let screen: ReactNode;
  switch (route.screen) {
    case 'menu':
    case 'matchmaking':
      screen = (
        <>
          <MenuScreen prefs={prefs} onPlay={play} onSettings={() => setSettingsOpen(true)} showSeed={dev} />
          {route.screen === 'matchmaking' && (
            <MatchmakingOverlay
              matchmaking={route.matchmaking}
              onCancelled={toMenu}
              onReady={(s) => setRoute({ screen: 'match', session: s })}
              onRetry={() => play()}
              onOffline={offline ? playOffline : undefined}
            />
          )}
        </>
      );
      break;
    case 'match':
    case 'end': {
      const { session: current } = route;
      screen = (
        <>
          <MatchScreen
            session={current}
            prefs={prefs}
            quality={settings.quality}
            reducedMotion={settings.reducedMotion}
            showStats={dev || test !== null}
            timeScale={test?.timeScale ?? 1}
            muted={settings.sound.muted}
            onToggleMute={() => prefs.getState().setMuted(!prefs.getState().settings.sound.muted)}
            onLeave={toMenu}
            onFailed={(failure) => {
              current.leave();
              if (failure.reason === 'seat-lost') {
                // The match carried on without me: back to the menu, saying so (spec #4 §5.2).
                showToast(failure.message);
                setRoute({ screen: 'menu' });
              } else {
                setRoute({ screen: 'error', message: failure.message });
              }
            }}
            onFinished={(rankings) => setRoute({ screen: 'end', session: current, rankings })}
          />
          {route.screen === 'end' && (
            <EndScreen
              rankings={route.rankings}
              seats={current.seats}
              me={current.me}
              onPlayAgain={() => {
                current.leave();
                play();
              }}
              onMenu={() => {
                current.leave();
                toMenu();
              }}
            />
          )}
        </>
      );
      break;
    }
    case 'error':
      screen = <ErrorScreen message={route.message} showDetails={dev} onMenu={toMenu} />;
      break;
  }

  const firstTap = (e: ReactPointerEvent) => {
    if (tappedRef.current) return;
    tappedRef.current = true;
    const env = {
      pointerType: e.pointerType,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      fullscreenEnabled: document.fullscreenEnabled,
      inFullscreen: document.fullscreenElement !== null,
    };
    if (wantsFullscreen(env)) document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className={settings.reducedMotion ? 'app reduced-motion' : 'app'} onPointerDownCapture={firstTap}>
      <CrashBoundary
        key={crashes}
        dev={dev}
        onMenu={() => {
          session?.leave();
          setRoute({ screen: 'menu' });
          setCrashes((c) => c + 1);
        }}
      >
        {screen}
        {settingsOpen && <SettingsDialog prefs={prefs} onClose={() => setSettingsOpen(false)} />}
        <LoadingScreen onRetry={() => window.location.reload()} />
        {route.screen !== 'match' && route.screen !== 'end' && <ToastHost />}
      </CrashBoundary>
      <RotateScreen />
    </div>
  );
}

interface CrashBoundaryProps {
  dev: boolean;
  onMenu: () => void;
  children: ReactNode;
}

/** Any crash while drawing the screens shows the error screen (spec #2 §4.1, §8). */
class CrashBoundary extends Component<CrashBoundaryProps, { error: unknown }> {
  override state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    return <ErrorScreen message={message} showDetails={this.props.dev} onMenu={this.props.onMenu} />;
  }
}
