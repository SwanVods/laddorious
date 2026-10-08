import type { Ranking } from '@laddorious/core';
import { Component, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { FindOptions, Matchmaking, MatchService, MatchSession } from '../service/matchService';
import { RotateScreen } from '../ui/RotateScreen';
import { EndScreen } from './EndScreen';
import { ErrorScreen } from './ErrorScreen';
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
export function App({ service, prefs, dev, test = null }: AppProps) {
  const [route, setRoute] = useState<Route>({ screen: 'menu' });
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

  const toMenu = () => setRoute({ screen: 'menu' });
  const play = (opts: FindOptions = {}) => setRoute({ screen: 'matchmaking', matchmaking: service.findMatch(prefs.getState().profile, opts) });
  const session = route.screen === 'match' || route.screen === 'end' ? route.session : null;

  let screen: ReactNode;
  switch (route.screen) {
    case 'menu':
    case 'matchmaking':
      screen = (
        <>
          <MenuScreen prefs={prefs} onPlay={play} onSettings={() => setSettingsOpen(true)} showSeed={dev} />
          {route.screen === 'matchmaking' && (
            <MatchmakingOverlay matchmaking={route.matchmaking} onCancelled={toMenu} onReady={(s) => setRoute({ screen: 'match', session: s })} />
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
            quality={settings.quality}
            reducedMotion={settings.reducedMotion}
            showStats={dev || test !== null}
            timeScale={test?.timeScale ?? 1}
            onLeave={toMenu}
            onFailed={(message) => {
              current.leave();
              setRoute({ screen: 'error', message });
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
      platform: navigator.platform,
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
