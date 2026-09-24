import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { sections } from './sections';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        {sections.map((s) => (
          <Route key={s.path} path={s.path} element={<s.Component />} />
        ))}
      </Routes>
    </HashRouter>
  );
}
