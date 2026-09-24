// Figma-exact primitives for the lessons-a pages. The page chrome (TopBar, BottomNav) comes from
// src/shared/ui; these local Reading/PageHead/Prose/Callout/Badge keep the exact Figma metrics of
// frames 57:619, 61:1149, 73:2 and 94:46 (see TODO.md for the shared-UI differences).
import type { ReactNode } from 'react';
export { LessonPage } from '../../shared/ui';

export function Reading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px] ${className}`}>{children}</div>;
}

export function PageHead({ eyebrow, title, subtitle, lede }: { eyebrow: string; title: string; subtitle?: string; lede: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="eyebrow text-text-link">{eyebrow}</p>
      <h1 className="w-[900px] font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-text-primary">{title}</h1>
      {subtitle && <p className="w-[900px] font-heading text-[24px] leading-[32px] font-medium tracking-[-0.5px] text-text-secondary">{subtitle}</p>}
      <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">{lede}</p>
    </div>
  );
}

/** 680 px reading column. h2 = heading/h2, p = body/md, gap 24. */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`prose-col flex w-[680px] flex-col items-start gap-[24px] text-text-primary ${className}`}>{children}</div>;
}

export function Callout({ kind, title, children, className = '' }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode; className?: string }) {
  const skin = kind === 'note' ? 'bg-surface-panel border-l-4 border-accent-primary' : kind === 'why' ? 'bg-surface-card border border-border-strong' : 'bg-surface-panel border-l-4 border-red-600';
  const word = kind === 'note' ? 'Note' : kind === 'why' ? 'Why?' : 'Careful';
  const wordColor = kind === 'why' ? 'text-text-link' : 'text-text-secondary';
  return (
    <aside className={`flex flex-col items-start gap-[8px] px-[24px] py-[16px] ${skin} ${className}`}>
      <p className={`eyebrow ${wordColor}`}>{word}</p>
      <p className="w-full font-body text-[14px] leading-[20px] font-medium text-text-primary">{title}</p>
      <div className="w-full font-body text-[14px] leading-[20px] text-text-primary whitespace-pre-line">{children}</div>
    </aside>
  );
}

type Source = 'bias' | 'dark' | 'flat' | 'noise' | 'external';
const BADGE: Record<Source, { label: string; bg: string; border: string; glyph: ReactNode }> = {
  bias: { label: 'Bias', bg: 'bg-source-bias-soft', border: 'border-source-bias', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="#1F4AA8" /></svg> },
  dark: { label: 'Dark', bg: 'bg-source-dark-soft', border: 'border-source-dark', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" fill="#C8321F" /></svg> },
  flat: { label: 'Flat', bg: 'bg-source-flat-soft', border: 'border-source-flat', glyph: <svg width="13" height="12" viewBox="0 0 13 12"><path d="M6.5 0L12.13 9H0.87L6.5 0Z" fill="#E3A81E" /></svg> },
  noise: { label: 'Random noise', bg: 'bg-source-noise-soft', border: 'border-source-noise', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L12 6L6 12L0 6L6 0Z" fill="#8B8B8B" /></svg> },
  external: { label: 'Outside the camera', bg: 'bg-source-external-soft', border: 'border-source-external', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L11.7 4.15L9.53 10.85H2.47L0.29 4.15L6 0Z" fill="#6B3FA0" /></svg> },
};
export function Badge({ source }: { source: Source }) {
  const b = BADGE[source];
  return (
    <span className={`inline-flex items-center gap-[8px] rounded-sm border px-[8px] py-[4px] ${b.bg} ${b.border}`}>
      <span className="flex size-[12px] items-center justify-center">{b.glyph}</span>
      <span className="font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] whitespace-nowrap text-text-primary">{b.label}</span>
    </span>
  );
}
