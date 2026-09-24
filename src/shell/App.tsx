import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { sections } from './sections';

export function App() {
  const first = sections[0]?.path ?? '/welcome';
  return (
    <HashRouter>
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
