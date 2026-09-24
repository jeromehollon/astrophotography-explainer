// Global scale + zero offset normalization (SPEC §6.5, wbpp.md §4.2–4.3):
//   y = (C − m_i)·(s_r/s_i) + m_r,  m = median, s = √BWMV, r = the learner's reference frame.
// Coefficients come from normalization.json: frames[id].states[calState] = { median_dn, bwmv_dn, madn_dn }.

export type NormStats = { median_dn: number; bwmv_dn: number; madn_dn: number };

export type NormCoeff = { scale: number; offset: number };

export function normCoeff(frame: NormStats, ref: NormStats): NormCoeff {
  const scale = frame.bwmv_dn > 0 ? ref.bwmv_dn / frame.bwmv_dn : 1;
  return { scale, offset: ref.median_dn - frame.median_dn * scale };
}

/** In place: data[i] = data[i]·scale + offset (NaN stays NaN). */
export function normalizeInPlace(data: Float32Array, c: NormCoeff): Float32Array {
  const { scale, offset } = c;
  for (let i = 0; i < data.length; i++) data[i] = data[i] * scale + offset;
  return data;
}
