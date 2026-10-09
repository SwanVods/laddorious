import type { PlayerId } from '@laddorious/core';
import type { Seat } from '@laddorious/host';

/** A seat to come back to after a reload (spec #4 §3.3, §7). Kept only in this tab's sessionStorage. */
export interface SavedSeat {
  matchId: string;
  token: string;
  me: PlayerId;
  seats: Seat[];
}

/** The part of Storage the saved seat uses. */
export interface SeatStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SEAT_KEY = 'laddorious.seat';

/** This tab's sessionStorage, or null where it's blocked. */
export function tabStorage(): SeatStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function saveSeat(store: SeatStore | null, seat: SavedSeat): void {
  try {
    store?.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    // full or blocked: no rejoin after a reload
  }
}

/** The saved seat, or null if there is none or it doesn't read back. */
export function loadSeat(store: SeatStore | null): SavedSeat | null {
  try {
    const raw = store?.getItem(SEAT_KEY);
    if (!raw) return null;
    const seat = JSON.parse(raw) as Partial<SavedSeat>;
    const ok = typeof seat.matchId === 'string' && typeof seat.token === 'string' && typeof seat.me === 'string' && Array.isArray(seat.seats);
    return ok ? (seat as SavedSeat) : null;
  } catch {
    return null;
  }
}

export function clearSeat(store: SeatStore | null): void {
  try {
    store?.removeItem(SEAT_KEY);
  } catch {
    // blocked
  }
}
