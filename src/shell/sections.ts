import type { ComponentType } from 'react';
import Welcome from '../sections/welcome';
import Noise from '../sections/noise';
import Alignment from '../sections/alignment';
import LightFrames from '../sections/light-frames';

/** One entry per app page. Section agents append exactly one line each, in wizard order (SPEC §7, docs/contracts.md). */
export type Section = {
  path: string;      // '/welcome' | '/noise' | '/calibration/bias' | ... | '/workbench'
  chapter: string;   // TopBar row 1: 'Welcome' | 'Noise & Defects' | 'Calibration' | 'Alignment' | 'Algorithms' | 'Light frames' | 'Workbench'
  page: string;      // TopBar row 2 label; '' for single-page chapters
  title: string;     // BottomNav label, e.g. 'Noise & Defects'
  Component: ComponentType;
};

export const sections: Section[] = [
  { path: '/welcome', chapter: 'Welcome', page: '', title: 'Welcome', Component: Welcome },
  { path: '/noise', chapter: 'Noise & Defects', page: '', title: 'Noise & Defects', Component: Noise },
  { path: '/alignment', chapter: 'Alignment', page: '', title: 'Alignment', Component: Alignment },
  { path: '/light-frames', chapter: 'Light frames', page: 'Image Worthiness', title: 'Light frames', Component: LightFrames },
];
