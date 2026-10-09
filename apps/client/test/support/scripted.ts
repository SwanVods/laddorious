import type { InputErrorCode } from '@laddorious/core';
import type { FailReason } from '@laddorious/host';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { MatchFailure, Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../../src/service/matchService';
import { SEATS } from './fixtures';

/** Matchmaking a component test drives by hand. */
export class ScriptedMatchmaking implements Matchmaking {
  private listener: ((s: MatchmakingState) => void) | null = null;
  cancel = vi.fn();
  playWithBots = vi.fn();

  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }

  emit(s: MatchmakingState): void {
    act(() => this.listener?.(s));
  }
}

/** A match session a component test drives by hand: updates, rejections and failures go in through act(). */
export class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private rejected: ((e: { code: InputErrorCode; message: string }) => void) | null = null;
  private failed: ((e: MatchFailure) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {
      if (this.updated === cb) this.updated = null;
    };
  }

  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void {
    this.rejected = cb;
    return () => {
      if (this.rejected === cb) this.rejected = null;
    };
  }

  onFailed(cb: (e: MatchFailure) => void): () => void {
    this.failed = cb;
    return () => {
      if (this.failed === cb) this.failed = null;
    };
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  reject(code: InputErrorCode, message = code): void {
    act(() => this.rejected?.({ code, message }));
  }

  fail(message: string, reason?: FailReason): void {
    act(() => this.failed?.(reason ? { message, reason } : { message }));
  }

  private presenceCb: ((away: string[]) => void) | null = null;

  onPresence(cb: (away: string[]) => void): () => void {
    this.presenceCb = cb;
    return () => {
      if (this.presenceCb === cb) this.presenceCb = null;
    };
  }

  presence(away: string[]): void {
    act(() => this.presenceCb?.(away));
  }
}
