// Section-local renderings of the Figma ROITile (9:337, with the tile's head bar, border and
// in-tile caption) and Callout (9:210, "Why?" box) and the eyebrow text style. The Foundation
// stubs in src/shared/ui draw these differently from the lesson frames; see TODO.md.
import type { ReactNode } from 'react';

export function ROITile({ title, caption, well, children }: { title: string; caption: string; well?: { w: number; h: number }; children: ReactNode }) {
  const size = well ?? { w: 318, h: 240 };
  return (
    <figure className="m-0 flex w-[320px] flex-col border border-border-on-stage bg-surface-stage-raised">
      <figcaption className="flex w-full items-center px-[12px] py-[10px]">
        <span className="t-label-md whitespace-nowrap text-text-on-stage">{title}</span>
      </figcaption>
      <div className="relative overflow-hidden" style={{ width: size.w, height: size.h }}>{children}</div>
      <div className="flex w-full flex-col px-[12px] py-[10px]">
        <p className="m-0 w-full t-body-sm text-text-on-stage-muted">{caption}</p>
      </div>
    </figure>
  );
}

export function WhyCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex w-[440px] flex-col gap-[8px] border border-border-strong bg-surface-card px-[24px] py-[16px]">
      <p className="m-0 t-eyebrow text-text-link">Why?</p>
      <p className="m-0 t-label-md text-text-primary">{title}</p>
      <p className="m-0 t-body-sm text-text-primary">{children}</p>
    </aside>
  );
}

export function Eyebrow({ children, onStage, dark }: { children: ReactNode; onStage?: boolean; dark?: boolean }) {
  const color = onStage ? 'text-text-on-stage-muted' : dark ? 'text-text-primary' : 'text-text-link';
  return <p className={`m-0 t-eyebrow whitespace-nowrap ${color}`}>{children}</p>;
}
