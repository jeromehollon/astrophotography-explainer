/**
 * Page chrome for the two workbench pages.
 */
import type { ReactNode } from 'react';
import { cx, T } from './ui';

/** TopBar + main + BottomNav come from the shared library; Reading and PageHead below match the P8-2/P9 frames (gap 12, link-coloured eyebrow, secondary lede). */
export { LessonPage } from '../../shared/ui';

export function Reading({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto flex w-[1200px] flex-col gap-8 py-16', className)}>{children}</div>;
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: ReactNode }) {
  return (
    <header className="flex w-[900px] flex-col gap-3">
      <div className={cx('text-text-link whitespace-nowrap', T.eyebrow)}>{eyebrow}</div>
      <h1 className={cx('m-0 text-text-primary', T.h1)}>{title}</h1>
      <p className={cx('m-0 w-[680px] text-text-secondary', T.bodyLg)}>{lede}</p>
    </header>
  );
}
