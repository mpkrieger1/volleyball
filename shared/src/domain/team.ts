import { z } from 'zod';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const ConferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbr: z.string().min(2).max(8),
  tier: z.enum(['P4', 'G5', 'MID', 'IND']),
  autoBidEligible: z.boolean(),
});
export type ConferenceInput = z.infer<typeof ConferenceSchema>;

export const TeamSchema = z.object({
  schoolName: z.string().min(1),
  abbr: z.string().min(2).max(5),
  conferenceId: z.string().min(1),
  primaryColor: z.string().regex(HEX_COLOR, 'primaryColor must be "#RRGGBB"'),
  secondaryColor: z.string().regex(HEX_COLOR, 'secondaryColor must be "#RRGGBB"'),
  prestige: z.number().int().min(0).max(100),
  logoPath: z.string().min(1),
});
export type TeamInput = z.infer<typeof TeamSchema>;
