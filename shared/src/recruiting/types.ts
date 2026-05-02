// Sprint 12: recruit generator types.

import type { PlayerRatings } from '../sim/ratings';

export const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'] as const;
export type Position = (typeof POSITIONS)[number];

export const REGIONS = ['EAST', 'CENTRAL', 'MOUNTAIN', 'PACIFIC'] as const;
export type Region = (typeof REGIONS)[number];

/** Broad bucket tag used to weight names at generation time. Never surfaced to the user. */
export const ETHNICITY_TAGS = ['GENERAL', 'EUROPEAN', 'HISPANIC', 'AFRICAN', 'ASIAN', 'PACIFIC'] as const;
export type EthnicityTag = (typeof ETHNICITY_TAGS)[number];

export type NameEntry = {
  name: string;
  tag: EthnicityTag;
  weight: number;
};

export type Hometown = {
  city: string;
  state: string; // 2-letter
  region: Region;
  weight: number;
};

export type GeneratedRecruit = {
  firstName: string;
  lastName: string;
  position: Position;
  stars: 1 | 2 | 3 | 4 | 5;
  height: number; // cm
  hometownCity: string;
  hometownState: string;
  hometownRegion: Region;
  ratings: PlayerRatings;
  potential: number; // 0..100
};
