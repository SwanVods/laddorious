import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import type { PlayingBeat } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { bannerFor, type BannerModel } from './model';

/** How long a banner stays up, whatever the length of its beat. */
export const BANNER_MS = 1700;

type Shown = BannerModel & { key: number };

/** The banner for the beat on stage, kept up for BANNER_MS even when the beat is shorter. */
export function useBanner(beat: PlayingBeat | null, me: PlayerId, seats: readonly SeatInfo[]): Shown | null {
  const [seen, setSeen] = useState<number | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [waiting, setWaiting] = useState<Shown | null>(null);
  if (beat && beat.startedAt !== seen) {
    setSeen(beat.startedAt);
    const banner = bannerFor(beat, me, seats);
    if (banner?.delayMs) setWaiting({ ...banner, key: beat.startedAt });
    else if (banner) setShown({ ...banner, key: beat.startedAt });
  }
  // A banner that waits (a face-off's result) shows once its delay has passed.
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setShown(waiting);
      setWaiting(null);
    }, waiting.delayMs);
    return () => clearTimeout(timer);
  }, [waiting]);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}

/** The big word over the board ("FACE-OFF!", "BLOCKED!", "VICTORY!"), popping in and out. */
export function BannerView({ banner }: { banner: Shown | null }) {
  if (!banner) return null;
  return (
    <div key={banner.key} className={`banner ${banner.tone}`} aria-live="polite">
      {banner.text}
    </div>
  );
}
