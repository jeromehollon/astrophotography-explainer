import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { sections } from './sections';

/** Each wizard page starts at the top; without this a hash-route change keeps the previous scroll offset. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  const first = sections[0]?.path ?? '/welcome';
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to={first} replace />} />
        {sections.map((s) => (
          <Route key={s.path} path={s.path} element={<s.Component />} />
        ))}
        <Route path="*" element={<Navigate to={first} replace />} />
      </Routes>
    </HashRouter>
  );
}
