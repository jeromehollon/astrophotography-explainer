import type { ComponentType } from 'react';

/** One entry per app page. Section agents append exactly one line each, in wizard order (SPEC §7, docs/contracts.md). */
export type Section = {
  path: string;      // '/welcome' | '/noise' | '/calibration/bias' | ... | '/workbench'
  chapter: string;   // TopBar row 1: 'Welcome' | 'Noise & Defects' | 'Calibration' | 'Alignment' | 'Algorithms' | 'Light frames' | 'Workbench'
  page: string;      // TopBar row 2 label; '' for single-page chapters
  title: string;     // BottomNav label, e.g. 'Noise & Defects'
  Component: ComponentType;
};

import Flats from '../sections/flats';
import Flats2 from '../sections/flats-2';

export const sections: Section[] = [
  { path: '/calibration/flats', chapter: 'Calibration', page: 'Flats', title: 'Flats', Component: Flats },
  { path: '/calibration/flats-2', chapter: 'Calibration', page: 'Flats, continued', title: 'Flats, continued', Component: Flats2 },
];
