import type { ComponentType } from 'react';
import Algorithms from '../sections/algorithms';
import LightFramesReview from '../sections/light-frames-review';
import Workbench from '../sections/workbench';

/** One entry per app page. Section agents append exactly one line each, in wizard order (SPEC §7, docs/contracts.md). */
export type Section = {
  path: string;      // '/welcome' | '/noise' | '/calibration/bias' | ... | '/workbench'
  chapter: string;   // TopBar row 1: 'Welcome' | 'Noise & Defects' | 'Calibration' | 'Alignment' | 'Algorithms' | 'Light frames' | 'Workbench'
  page: string;      // TopBar row 2 label; '' for single-page chapters
  title: string;     // BottomNav label, e.g. 'Noise & Defects'
  Component: ComponentType;
};

export const sections: Section[] = [
  { path: '/algorithms', chapter: 'Algorithms', page: '', title: 'Algorithms', Component: Algorithms },
  { path: '/light-frames/review', chapter: 'Light frames', page: 'Review the Exposures', title: 'Review the exposures', Component: LightFramesReview },
  { path: '/workbench', chapter: 'Workbench', page: '', title: 'Workbench', Component: Workbench },
];
