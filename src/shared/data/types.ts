// Runtime data shapes (docs/contracts.md "Runtime data", SPEC §4.2).

export type AssetKind = 'light' | 'master' | 'flat' | 'darkflat';

export type Asset = {
  id: string;
  kind: AssetKind;
  width: number;
  height: number;
  dtype: 'u16' | 'f32';
  files: Record<string, string>;
  pier_side?: 'West' | 'East';
  defect?: 'none' | 'satellite' | 'tracking' | 'cloud';
  relative_of?: string | null;
  /** canonical (f07) → this frame's sensor, row-major 3×3 */
  H?: number[];
  header?: { date_obs?: string; exptime?: number; ccd_temp?: number; gain?: number; offset?: number };
  wbpp_weight?: number | null;
};

export type Manifest = { reference: string; pixel_scale_arcsec: number; assets: Record<string, Asset> };

export type NormalizationJson = {
  border_px: number;
  frames: Record<string, { id: string; states: Record<string, { median_dn: number; bwmv_dn: number; madn_dn: number }> }>;
};

export type MasterJson = {
  id: string; kind: string; level?: number; flat_cal?: string;
  median_dn?: number; mean_dn?: number; scale_f_v?: { unit_0_1: number; dn: number };
};
export type MastersJson = Record<string, MasterJson>;
