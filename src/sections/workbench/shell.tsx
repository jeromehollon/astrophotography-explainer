/**
 * Page chrome for the two workbench pages. Uses the shared LessonPage/Reading/PageHead from
 * src/shared/ui when the foundation lands them; this file is the single place to swap.
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { sections } from '../../shell/sections';
import { cx, T } from './ui';

function useNav() {
  const { pathname } = useLocation();
  const index = sections.findIndex((s) => s.path === pathname);
  const current = index >= 0 ? sections[index] : undefined;
  const chapters = [...new Set(sections.map((s) => s.chapter))];
  const pages = current ? sections.filter((s) => s.chapter === current.chapter) : [];
  return { current, chapters, pages, prev: index > 0 ? sections[index - 1] : undefined, next: index >= 0 ? sections[index + 1] : undefined };
}

export function TopBar() {
  const { current, chapters, pages } = useNav();
  const firstOf = (chapter: string) => sections.find((s) => s.chapter === chapter)!;
  return (
    <nav className="w-full border-b border-border-strong bg-surface-page" aria-label="Chapters">
      <div className="mx-auto flex h-16 w-[1200px] items-center gap-12">
        <Link to="/welcome" className={cx('text-text-primary no-underline', T.h3)}>Calibration &amp; Stacking</Link>
        <ul className="m-0 flex list-none items-center gap-8 p-0">
          {chapters.map((c) => {
            const active = current?.chapter === c;
            return (
              <li key={c}>
                <Link to={firstOf(c).path} aria-current={active ? 'page' : undefined}
                  className={cx('inline-flex h-16 items-center border-b-[3px] no-underline', T.labelMd, active ? 'border-border-strong text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary')}>
                  {c}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mx-auto flex h-10 w-[1200px] items-center gap-6">
        {pages.filter((p) => p.page).map((p) => (
          <Link key={p.path} to={p.path} aria-current={current?.path === p.path ? 'page' : undefined}
            className={cx('no-underline', T.labelMd, current?.path === p.path ? 'text-text-primary underline' : 'text-text-secondary hover:text-text-primary')}>
            {p.page}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { prev, next } = useNav();
  const label = (s: NonNullable<typeof prev>) => (s.page ? `${s.chapter}: ${s.page}` : s.chapter);
  return (
    <nav className="w-full border-t border-border-strong bg-surface-page" aria-label="Pages">
      <div className="mx-auto flex h-20 w-[1200px] items-center justify-between">
        {prev ? <Link to={prev.path} className={cx('rounded-md border-2 border-border-strong bg-surface-card px-6 py-3 text-text-primary no-underline', T.labelMd)}>← {label(prev)}</Link> : <span />}
        {next ? <Link to={next.path} className={cx('rounded-md bg-accent-primary px-6 py-3 text-text-on-accent no-underline', T.labelMd)}>{label(next)} →</Link> : <span />}
      </div>
    </nav>
  );
}

export function LessonPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <TopBar />
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}

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
