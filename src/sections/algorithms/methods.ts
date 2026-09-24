// The Average / Median choice on the Algorithms page and how it reaches the shared store.
import { useAppStore } from '../../shared/store';

export type Method = 'average' | 'median';

/** Record the chosen method in the shared store without touching any other field. */
export function recordMethod(name: Method) {
  const { set, algorithm } = useAppStore.getState();
  set({ algorithm: { name, params: algorithm.params } });
}
