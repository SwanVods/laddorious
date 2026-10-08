import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { PIECE_NAMES } from '../hud/labels';
import { MenuScene, type MenuAnchor } from '../scene/MenuScene';
import { createTagRegistry } from '../scene/tags';
import { PIECES, type FindOptions } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { PieceIcon, Portrait } from '../ui/PieceIcon';
import { NICKNAME_MAX, type PrefsState } from './prefs';
import { SEAT_COLORS } from './theme';

/** Short rule reminders, one at a time (spec #2 §7.1). */
export const TIPS = [
  'Everyone rolls one die at the same time.',
  'Purple ? squares give you a card to play.',
  "Land on a slide's vacuum and it pulls you back down.",
  'Launch pads fling you ahead.',
  'Two pieces on one tile? Rock, paper, scissors decides who stays.',
] as const;
export const TIP_MS = 5000;

interface MenuScreenProps {
  prefs: StoreApi<PrefsState>;
  /** PLAY: start matchmaking, with a board seed in dev builds. */
  onPlay: (opts: FindOptions) => void;
  onSettings: () => void;
  /** Dev builds: the hidden board seed field (spec #2 §4.4). */
  showSeed?: boolean;
}

/**
 * The main menu (spec #2 §7.1, per the menu mockup): your piece turning on a podium with your
 * name on its plate, the profile chip (tap to rename), the logo, the settings gear, the piece
 * picker with arrows beside the podium, PLAY, and rotating rule tips.
 */
export function MenuScreen({ prefs, onPlay, onSettings, showSeed = false }: MenuScreenProps) {
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
  const cycle = (step: number) => {
    const i = PIECES.indexOf(profile.piece);
    prefs.getState().setPiece(PIECES[(i + step + PIECES.length) % PIECES.length]!);
  };
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
        </div>
        <button ref={anchor('prev')} type="button" className="menu-anchor round-btn live" aria-label="Previous piece" onClick={() => cycle(-1)}>
          <Icon name="back" />
        </button>
        <button ref={anchor('next')} type="button" className="menu-anchor round-btn live" aria-label="Next piece" onClick={() => cycle(1)}>
          <Icon name="next" />
        </button>

        <div className="profile-chip live">
          <Portrait piece={profile.piece} color={SEAT_COLORS.you} />
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

        <button type="button" className="round-btn gear-btn live" aria-label="Settings" onClick={onSettings}>
          <Icon name="gear" />
        </button>
        {showSeed && (
          <input className="seed-input live" aria-label="Board seed (dev)" placeholder="Board seed (dev)" value={seed} onChange={(e) => setSeed(e.target.value)} />
        )}

        <div className="picker live" role="group" aria-label="Choose your piece">
          {PIECES.map((piece) => (
            <button key={piece} type="button" className="picker-tile display" aria-pressed={piece === profile.piece} onClick={() => prefs.getState().setPiece(piece)}>
              <span className="picker-icon">
                <PieceIcon piece={piece} />
              </span>
              {PIECE_NAMES[piece]}
            </button>
          ))}
        </div>

        <div className="play-wrap live">
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
