import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { PIECE_NAMES } from '../hud/labels';
import { MenuScene, type MenuAnchor } from '../scene/MenuScene';
import { createTagRegistry } from '../scene/tags';
import { PIECES, type FindOptions } from '../service/matchService';
import { FullscreenButton } from '../ui/FullscreenButton';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';
import { NICKNAME_MAX, type PrefsState } from './prefs';
import { SEAT_COLORS } from './theme';

/** Short rule reminders, one at a time (spec #2 §7.1). */
export const TIPS = [
  'Everyone rolls one die at the same time.',
  'Purple ? squares give you a card to play.',
  'Stop on a whirlpool and it drags you back down.',
  'Rockets launch you up the board.',
  'Two pieces on one tile? Rock, paper, scissors decides who stays.',
] as const;
export const TIP_MS = 5000;

interface MenuScreenProps {
  prefs: StoreApi<PrefsState>;
  /** PLAY: start matchmaking, with a board seed in dev builds. */
  onPlay: (opts: FindOptions) => void;
  onSettings: () => void;
  /** How to play (2026-10-17). */
  onHelp?: () => void;
  /** Online builds: Play with friends, for private rooms (2026-10-16). */
  onFriends?: () => void;
  /** Dev builds: the hidden board seed field (spec #2 §4.4). */
  showSeed?: boolean;
}

/**
 * The main menu (spec #2 §7.1, per the menu mockup): your piece turning on a podium with your
 * name and the piece's name on its plate, arrows beside the podium to choose the piece (the strip of
 * pieces went on 2026-10-14), the profile chip (tap to rename), the logo, the settings gear, PLAY, and
 * rotating rule tips.
 */
export function MenuScreen({ prefs, onPlay, onSettings, onHelp, onFriends, showSeed = false }: MenuScreenProps) {
  const profile = useStore(prefs, (s) => s.profile);
  const settings = useStore(prefs, (s) => s.settings);
  const [anchors] = useState(createTagRegistry);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [tip, setTip] = useState(0);
  const [seed, setSeed] = useState('');
  // Enter or Esc ends a rename once; a blur fired as the field unmounts must not save again.
  const renameDoneRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS);
    return () => clearInterval(id);
  }, []);

  const anchor = (key: MenuAnchor) => (el: HTMLElement | null) => {
    if (el) anchors.elements.set(key, el);
    else anchors.elements.delete(key);
  };
  /** The index of the piece an arrow picks: its pick sound plays that piece's note (spec #3 §5). */
  const stepped = (step: number) => (PIECES.indexOf(profile.piece) + step + PIECES.length) % PIECES.length;
  const cycle = (step: number) => prefs.getState().setPiece(PIECES[stepped(step)]!);
  const finishRename = (save: boolean) => {
    if (renameDoneRef.current) return;
    renameDoneRef.current = true;
    if (save) prefs.getState().rename(draft);
    setEditing(false);
  };

  return (
    <div className="screen menu">
      <MenuScene key={settings.quality} piece={profile.piece} setting={settings.quality} reducedMotion={settings.reducedMotion} anchors={anchors} />
      <div className="layer">
        <div ref={anchor('plate')} className="menu-anchor menu-plate display">
          {profile.nickname}
          <small data-testid="piece-name">{PIECE_NAMES[profile.piece]}</small>
        </div>
        <button ref={anchor('prev')} type="button" className="menu-anchor round-btn live" aria-label="Previous piece" data-sound="U2" data-sound-arg={stepped(-1)} onClick={() => cycle(-1)}>
          <Icon name="back" />
        </button>
        <button ref={anchor('next')} type="button" className="menu-anchor round-btn live" aria-label="Next piece" data-sound="U2" data-sound-arg={stepped(1)} onClick={() => cycle(1)}>
          <Icon name="next" />
        </button>

        <div className="profile-chip live">
          <Portrait piece={profile.piece} color={SEAT_COLORS[0]} />
          {editing ? (
            <input
              className="profile-input display"
              aria-label="Nickname"
              maxLength={NICKNAME_MAX}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename(true);
                if (e.key === 'Escape') finishRename(false);
              }}
              onBlur={() => finishRename(true)}
            />
          ) : (
            <button
              type="button"
              className="profile-name"
              aria-label={`Your profile: ${profile.nickname}. Tap to rename`}
              onClick={() => {
                setDraft(profile.nickname);
                renameDoneRef.current = false;
                setEditing(true);
              }}
            >
              <span className="display">
                {profile.nickname}
                <Icon name="pencil" />
              </span>
              <small>Guest · tap to rename</small>
            </button>
          )}
        </div>

        <h1 className="logo">
          <b className="display">
            LADDOR<span>IOUS</span>
          </b>
          <small>RACE TO 100</small>
        </h1>

        {onHelp && (
          <button type="button" className="round-btn help-btn live" aria-label="How to play" onClick={onHelp}>
            <Icon name="qmark" />
          </button>
        )}
        <FullscreenButton className="menu-fullscreen-btn" />
        <button type="button" className="round-btn gear-btn live" aria-label="Settings" onClick={onSettings}>
          <Icon name="gear" />
        </button>
        {showSeed && (
          <input className="seed-input live" aria-label="Board seed (dev)" placeholder="Board seed (dev)" value={seed} onChange={(e) => setSeed(e.target.value)} />
        )}


        <div className="play-wrap live">
          {onFriends && (
            <button type="button" className="btn friends-btn" onClick={onFriends}>
              Play with friends
            </button>
          )}
          <span className="pill play-caption">4-player match</span>
          <button type="button" className="btn primary play-btn" onClick={() => onPlay(seed.trim() ? { seed: seed.trim() } : {})}>
            <Icon name="play" />
            PLAY
          </button>
        </div>

        <p className="tip" role="note">
          <b className="display">TIP</b>
          <span>{TIPS[tip]}</span>
        </p>
      </div>
    </div>
  );
}
