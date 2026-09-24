import type { ComponentType } from 'react';

/** One entry per app page. Section agents append exactly one line each (SPEC §4.6). */
export type Section = {
  path: string;            // hash route, e.g. '/calibration/bias'
  chapter: string;         // TopBar chapter label, e.g. 'Calibration'
  page: string;            // page label inside the chapter, e.g. 'Bias'
  Component: ComponentType;
};

import Flats from '../sections/flats';
import Flats2 from '../sections/flats-2';

export const sections: Section[] = [
  { path: '/calibration/flats', chapter: 'Calibration', page: 'Flats', Component: Flats },
  { path: '/calibration/flats-2', chapter: 'Calibration', page: 'Flats, continued', Component: Flats2 },
];
