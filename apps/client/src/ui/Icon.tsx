import type { ReactNode } from 'react';
import type { IconName } from '../hud/labels';

// The HUD's icon set: 24×24, drawn in currentColor so CSS tokens colour them (spec #2 §7.4).

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PATHS: Record<IconName, ReactNode> = {
  arrow: <path d="M3 9.5h10V4.5l8 7.5-8 7.5v-5H3z" />,
  die: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" {...stroke} />
      <circle cx="8.5" cy="8.5" r="1.7" />
      <circle cx="15.5" cy="8.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="8.5" cy="15.5" r="1.7" />
      <circle cx="15.5" cy="15.5" r="1.7" />
    </>
  ),
  x2: (
    <>
      <path d="M3.5 7.5l2-2L9 9l3.5-3.5 2 2L11 11l3.5 3.5-2 2L9 13l-3.5 3.5-2-2L7 11z" />
      <path d="M15 13.2c.3-1.8 1.6-2.7 3-2.7 1.6 0 2.8 1 2.8 2.5 0 1.3-.8 2-2.2 3.1l-1 .8H21V19h-6.2v-1.7l2.6-2.2c1-.8 1.4-1.3 1.4-1.9 0-.5-.4-.9-1-.9-.7 0-1.1.5-1.2 1.2z" />
    </>
  ),
  pad: (
    <>
      <path d="M2.5 19h19v2.5h-19z" />
      <path d="M5 16.5C6.5 6 16.5 5.5 19 14" {...stroke} strokeDasharray="2.6 2.4" />
      <path d="M19.8 10.5l1.6 5.6-5.4-1.6z" />
    </>
  ),
  charm: (
    <>
      <path d="M7 19c0-4 10-3 10-7S7 9 7 5" {...stroke} />
      <path d="M4 4l16 16" {...stroke} />
    </>
  ),
  shield: <path d="M12 2.5l7.5 2.8v5.9c0 4.8-3.2 8.8-7.5 10.3-4.3-1.5-7.5-5.5-7.5-10.3V5.3z" />,
  aegis: (
    <>
      <path d="M12 2.5l7.5 2.8v5.9c0 4.8-3.2 8.8-7.5 10.3-4.3-1.5-7.5-5.5-7.5-10.3V5.3z" />
      <path className="icon-cut" d="M12 7.2l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" />
    </>
  ),
  push: <path d="M21 9.5H11V4.5L3 12l8 7.5v-5h10z" />,
  boot: <path d="M7 3h6.5v8.2l5.6 2.6c1.2.6 1.9 1.7 1.9 3V20H3.5v-3.6c0-1 .5-1.9 1.4-2.4L7 12.8z" />,
  swap: <path d="M4 7.5h11.5V4L21 8.8l-5.5 4.7V10H4zM20 16.5H8.5V20L3 15.2l5.5-4.7V14H20z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M12 7v10M9.3 9.6c.5-1 1.5-1.4 2.7-1.4 1.6 0 2.6.8 2.6 1.9s-1 1.6-2.6 1.9-2.6.8-2.6 1.9 1 1.9 2.6 1.9c1.2 0 2.2-.5 2.7-1.4" {...stroke} strokeWidth={2} />
    </>
  ),
  bait: <path d="M15 3v9.5a5 5 0 0 1-10 0V10l3 2.5M15 3l3 3" {...stroke} />,
  jackpot: (
    <>
      <rect x="2.5" y="7" width="11" height="11" rx="3" transform="rotate(-14 8 12.5)" />
      <rect x="10.5" y="5" width="11" height="11" rx="3" fillOpacity=".5" />
    </>
  ),
  steady: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" {...stroke} />
      <path d="M8 10h8M8 14h8" {...stroke} />
    </>
  ),
  cleanse: <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />,
  slide: <path d="M12 4a8 8 0 1 0 8 8 5.5 5.5 0 0 0-5.5-5.5A3.5 3.5 0 0 0 11 10a2 2 0 0 0 2 2" {...stroke} />,
  card: (
    <>
      <rect x="3.5" y="4" width="11.5" height="15.5" rx="2.5" transform="rotate(-10 9 12)" fillOpacity=".45" />
      <rect x="8.5" y="4" width="11.5" height="15.5" rx="2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...stroke} />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={3.4} />,
  bolt: <path d="M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-5.6z" />,
  eye: (
    <>
      <path d="M12 5.5c5 0 8.6 4 9.7 6.5-1.1 2.5-4.7 6.5-9.7 6.5S3.4 14.5 2.3 12C3.4 9.5 7 5.5 12 5.5z" />
      <circle className="icon-cut" cx="12" cy="12" r="3.2" />
    </>
  ),
  reroll: (
    <>
      <path d="M19 12.5a7 7 0 1 1-2.2-5.6" {...stroke} strokeWidth={2.8} />
      <path d="M21 3.5v6.5h-6.5z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7.5" {...stroke} strokeWidth={2.4} />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" {...stroke} strokeWidth={2.4} />
    </>
  ),
  qmark: <path d="M8.5 8.5a3.5 3.5 0 1 1 5.2 3c-1.2.7-1.7 1.4-1.7 2.7v.8M12 19.5v.5" {...stroke} strokeWidth={3} />,
  swords: (
    <>
      <path d="M4 3h2.2l10.3 10.3-2.2 2.2L4 5.2zM20 3h-2.2L7.5 13.3l2.2 2.2L20 5.2z" />
      <path d="M5 14.5l4.5 4.5M19 14.5L14.5 19M4.5 20.5l2-2M19.5 20.5l-2-2" {...stroke} />
    </>
  ),
  gear: (
    <path d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7c-.1-.6-.1-1.3 0-1.9l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" transform="translate(0 1.5) scale(1 .92)" />
  ),
  close: <path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth={3.5} />,
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  back: <path d="M15 4l-8 8 8 8" {...stroke} strokeWidth={3.5} />,
  next: <path d="M9 4l8 8-8 8" {...stroke} strokeWidth={3.5} />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" {...stroke} strokeWidth={3} />,
  speaker: (
    <>
      <path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z" />
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" {...stroke} />
    </>
  ),
  'speaker-off': (
    <>
      <path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z" />
      <path d="M16 9l5 6M21 9l-5 6" {...stroke} />
    </>
  ),
  pencil: <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3" {...stroke} strokeWidth={2.2} />,
  rock: (
    <>
      <path d="M5.5 10.5C5.5 7 8.3 4.8 12 4.8s6.8 2.1 6.8 5.4c0 1.1-.2 2.1-.6 3 .5.8.7 1.6.7 2.5 0 2.8-2.6 4.3-6.6 4.3-4.3 0-7.3-1.7-7.3-5.1 0-1 .3-1.9.9-2.6-.3-.6-.4-1.2-.4-1.8z" />
      <path className="icon-cut-line" d="M9 9.6c1 .6 2.2.7 3.2.2M13.6 13.2c.9.4 1.9.4 2.8 0" strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  paper: (
    <>
      <path d="M6 2.5h8.8L19.5 7v14.5H6z" />
      <path className="icon-cut" d="M14.8 2.5V7h4.7z" fillOpacity=".6" />
      <path className="icon-cut-line" d="M9 11h7.5M9 14.2h7.5M9 17.4h5" strokeWidth={1.5} strokeLinecap="round" />
    </>
  ),
  scissors: (
    <>
      <circle cx="7" cy="17.3" r="3.2" {...stroke} strokeWidth={2.4} />
      <circle cx="17" cy="17.3" r="3.2" {...stroke} strokeWidth={2.4} />
      <path d="M8.7 14.7L16.4 3l1.7 1.1-7.3 11.2zM15.3 14.7L7.6 3 5.9 4.1l7.3 11.2z" />
    </>
  ),
  trophy: <path d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.4A4.5 4.5 0 0 1 13 14.4V17h3v3H8v-3h3v-2.6A4.5 4.5 0 0 1 8.4 12H8a4 4 0 0 1-4-4V6h3zM6 8a2 2 0 0 0 1 1.7V8zm12 0h-1v1.7A2 2 0 0 0 18 8z" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
