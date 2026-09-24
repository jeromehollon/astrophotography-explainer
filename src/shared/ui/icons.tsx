import type { SVGProps } from 'react';

export type IconName =
  | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'check' | 'close' | 'info' | 'warning'
  | 'download' | 'play' | 'stop' | 'crosshair' | 'star' | 'reset' | 'eye';

/* 16 px grid, 1.5 px strokes, traced from "Library · Icons" (9:2). Colour follows currentColor. */
const PATHS: Record<IconName, React.ReactNode> = {
  'chevron-left': <path d="M10 3.5 5.5 8l4.5 4.5" />,
  'chevron-right': <path d="m6 3.5 4.5 4.5L6 12.5" />,
  'chevron-down': <path d="m3.5 6 4.5 4.5L12.5 6" />,
  check: <path d="m3 8.5 3.2 3L13 4.5" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  info: <><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v4M8 5.1v.1" /></>,
  warning: <><path d="M8 2.2 14.3 13H1.7L8 2.2Z" /><path d="M8 6.5v3.2M8 11.6v.1" /></>,
  download: <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M2.75 13.25h10.5" />,
  play: <path d="M4.5 3v10l8-5-8-5Z" fill="currentColor" stroke="none" />,
  stop: <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" stroke="none" />,
  crosshair: <><circle cx="8" cy="8" r="4.5" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" /></>,
  star: <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8l4.9-1.6L8 1.5Z" fill="currentColor" stroke="none" />,
  reset: <path d="M3 8a5 5 0 1 0 1.5-3.55M3 2.75v2.5h2.5" />,
  eye: <><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></>,
};

export function Icon({ name, size = 16, className, ...rest }: { name: IconName; size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      {PATHS[name]}
    </svg>
  );
}

/* Logo/Mark (123:2159): geometry from assets/brand/mark.svg. */
export function Logo({ size = 28, className }: { size?: 24 | 28 | 32; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <g transform="translate(-6 -5) rotate(-22 32 32)"><ellipse cx="32" cy="32" rx="24" ry="8.5" fill="#E0604B" /></g>
      <g transform="translate(6 5) rotate(-22 32 32)"><ellipse cx="32" cy="32" rx="24" ry="8.5" fill="#F2CE6B" /></g>
      <g transform="rotate(-22 32 32)"><ellipse cx="32" cy="32" rx="24" ry="8.5" fill="#1F4AA8" /><circle cx="32" cy="32" r="4.5" fill="#F7F2EA" /></g>
    </svg>
  );
}
