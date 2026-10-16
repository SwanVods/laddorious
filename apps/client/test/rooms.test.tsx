// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { roomLink } from '../src/app/MatchmakingOverlay';
import { createPrefsStore } from '../src/app/prefs';
import type { MatchService } from '../src/service/matchService';
import { ScriptedMatchmaking } from './support/scripted';

// Private rooms (the user, 2026-10-16): Play with friends opens a room with a code to share, or joins one
// by its code; a room link opens the game straight into the room.

vi.mock('../src/scene/MenuScene', async () => {
  const { createElement } = await import('react');
  return { MenuScene: () => createElement('div', { role: 'img', 'aria-label': 'Podium' }) };
});

afterEach(cleanup);

function setup({ online = true, joinCode = null }: { online?: boolean; joinCode?: string | null } = {}) {
  const made: ScriptedMatchmaking[] = [];
  const make = () => {
    const m = new ScriptedMatchmaking();
    made.push(m);
    return m;
  };
  const service = { findMatch: vi.fn(make), ...(online ? { createRoom: vi.fn(make), joinRoom: vi.fn(make) } : {}) } satisfies MatchService;
  const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
  render(<App service={service} prefs={prefs} dev={false} joinCode={joinCode} />);
  return { service, made, profile: prefs.getState().profile };
}

const friends = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Play with friends' }));
  return screen.getByRole('dialog', { name: 'Play with friends' });
};

describe('private rooms', () => {
  it('creates a room from Play with friends, and shows it', () => {
    const { service, made, profile } = setup();
    fireEvent.click(within(friends()).getByRole('button', { name: 'Create a room' }));
    expect(service.createRoom).toHaveBeenCalledWith(profile);
    made[0]!.emit({ kind: 'searching', elapsedMs: 0, seats: [null, null, null, null], room: { code: 'DUCK', host: true } });
    expect(screen.getByRole('dialog', { name: 'YOUR ROOM' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Play with friends' })).toBeNull();
  });

  it('joins a room by a typed code: four letters, made capitals', () => {
    const { service, profile } = setup();
    const dialog = friends();
    const join = within(dialog).getByRole('button', { name: 'Join' }) as HTMLButtonElement;
    const code = within(dialog).getByRole('textbox', { name: 'Room code' }) as HTMLInputElement;
    fireEvent.change(code, { target: { value: 'du' } });
    expect(join.disabled).toBe(true);
    fireEvent.change(code, { target: { value: 'du-ck9x' } });
    expect(code.value).toBe('DUCK');
    expect(join.disabled).toBe(false);
    fireEvent.click(join);
    expect(service.joinRoom).toHaveBeenCalledWith(profile, 'DUCK');
  });

  it('opens a room link straight into the room', () => {
    const { service, profile } = setup({ joinCode: 'duck' });
    expect(service.joinRoom).toHaveBeenCalledWith(profile, 'DUCK');
  });

  it('has no Play with friends when the game only plays offline', () => {
    setup({ online: false });
    expect(screen.queryByRole('button', { name: 'Play with friends' })).toBeNull();
  });

  it('makes the link to share', () => {
    expect(roomLink('DUCK', { origin: 'https://laddorious.example', pathname: '/' })).toBe('https://laddorious.example/?room=DUCK');
  });
});
