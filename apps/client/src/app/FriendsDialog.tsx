import { useId, useState } from 'react';
import { Dialog } from '../ui/Dialog';

/** A room code: four capital letters (the server's codes skip I and O). */
export const ROOM_CODE_LENGTH = 4;

/** What a typed code becomes: letters only, in capitals, four at most. */
export function cleanRoomCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

/**
 * Play with friends (the user, 2026-10-16): create a private room and get a code to share, or join a
 * friend's room by its code.
 */
export function FriendsDialog({ onCreate, onJoin, onClose }: { onCreate: () => void; onJoin: (code: string) => void; onClose: () => void }) {
  const [code, setCode] = useState('');
  const codeId = useId();
  const ready = code.length === ROOM_CODE_LENGTH;
  return (
    <Dialog title="Play with friends" className="friends-dialog" onClose={onClose}>
      <div className="friends-option">
        <p className="dialog-text">Get a code to share. You start the match when everyone is in; bots take any empty seats.</p>
        <button type="button" className="btn primary" onClick={onCreate}>
          Create a room
        </button>
      </div>
      <form
        className="friends-option"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onJoin(code);
        }}
      >
        <label className="dialog-text" htmlFor={codeId}>
          Or join a friend's room with their code.
        </label>
        <div className="friends-join">
          <input
            id={codeId}
            className="room-input display"
            aria-label="Room code"
            placeholder="CODE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(cleanRoomCode(e.target.value))}
          />
          <button type="submit" className="btn accent" disabled={!ready}>
            Join
          </button>
        </div>
      </form>
    </Dialog>
  );
}
