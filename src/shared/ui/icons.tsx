import type { SVGProps } from 'react';

export type IconName =
  | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'check' | 'close' | 'info' | 'warning'
  | 'download' | 'play' | 'stop' | 'crosshair' | 'star' | 'reset' | 'eye';

/* Paths traced from "Library · Icons" (9:2): 20 px grid, 2 px round strokes. Colour follows currentColor. */
const PATHS: Record<IconName, string> = {
  'chevron-left': 'M13 4L7 10L13 16',
  'chevron-right': 'M7 4L13 10L7 16',
  'chevron-down': 'M4 7L10 13L16 7',
  check: 'M4 10.5L8 14.5L16 5.5',
  close: 'M5 5L15 15M15 5L5 15',
  info: 'M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z M10 9V14M10 6.5V7',
  warning: 'M10 3L18 17H2L10 3Z M10 8V12M10 14V14.5',
  download: 'M10 3V13M14 9L10 13L6 9M4 16H16',
  play: 'M6 4L16 10L6 16V4Z',
  stop: 'M15 5H5V15H15V5Z',
  crosshair: 'M10 16C13.3137 16 16 13.3137 16 10C16 6.68629 13.3137 4 10 4C6.68629 4 4 6.68629 4 10C4 13.3137 6.68629 16 10 16Z M10 1V5M10 15V19M1 10H5M15 10H19',
  star: 'M10 2V18M2 10H18M4.5 4.5L15.5 15.5M15.5 4.5L4.5 15.5',
  reset: 'M4 10C4.00636 11.3726 4.48315 12.7015 5.35083 13.7651C6.21852 14.8286 7.42463 15.5625 8.76799 15.8444C10.1113 16.1262 11.5107 15.9389 12.7327 15.3137C13.9547 14.6886 14.9253 13.6633 15.4828 12.409C16.0403 11.1547 16.1508 9.7472 15.796 8.42125C15.4412 7.0953 14.6425 5.93108 13.5331 5.1228C12.4237 4.31453 11.0708 3.91106 9.69988 3.9797C8.329 4.04834 7.02309 4.58495 6 5.5M4 4V8H8',
  eye: 'M2 10C2 10 5 5 10 5C15 5 18 10 18 10C18 10 15 15 10 15C5 15 2 10 2 10Z M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z',
};

export function Icon({ name, size = 20, className, ...rest }: { name: IconName; size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* Logo/Mark (123:2159), same geometry as assets/brand/mark.svg: three tilted NGC 7331 silhouettes, cobalt on top with a cream core. */
export function Logo({ size = 28, className }: { size?: 24 | 28 | 32 | 64; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <ellipse cx="26" cy="27" rx="24" ry="8.5" transform="rotate(-22 26 27)" fill="#E0604B" />
      <ellipse cx="38" cy="37" rx="24" ry="8.5" transform="rotate(-22 38 37)" fill="#F2CE6B" />
      <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(-22 32 32)" fill="#1F4AA8" />
      <circle cx="32" cy="32" r="4.5" fill="#F7F2EA" />
    </svg>
  );
}
