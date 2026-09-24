import type { ComponentType } from 'react';

/** One entry per app page. Section agents append exactly one line each (SPEC §4.6). */
export type Section = {
  path: string;            // hash route, e.g. '/calibration/bias'
  chapter: string;         // TopBar chapter label, e.g. 'Calibration'
  page: string;            // page label inside the chapter, e.g. 'Bias'
  title: string;           // BottomNav label
  Component: ComponentType;
};

import Welcome from '../sections/welcome';
import Noise from '../sections/noise';
import Alignment from '../sections/alignment';
import LightFrames from '../sections/light-frames';

export const sections: Section[] = [
  { path: '/welcome', chapter: 'Welcome', page: '', title: 'Welcome', Component: Welcome },
  { path: '/noise', chapter: 'Noise & Defects', page: '', title: 'Noise & Defects', Component: Noise },
  { path: '/alignment', chapter: 'Alignment', page: '', title: 'Alignment', Component: Alignment },
  { path: '/light-frames', chapter: 'Light frames', page: 'Image Worthiness', title: 'Light frames', Component: LightFrames },
];
