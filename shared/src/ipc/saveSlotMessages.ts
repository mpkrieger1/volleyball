import { z } from 'zod';

export const SaveSlotSummary = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(), // ISO 8601
  lastOpenedAt: z.string(),
  dynastyYear: z.number().int(),
});
export type SaveSlotSummary = z.infer<typeof SaveSlotSummary>;

export const CreateSaveSlotRequest = z.object({
  name: z.string().min(1).max(40),
});
export type CreateSaveSlotRequest = z.infer<typeof CreateSaveSlotRequest>;

export const OpenSaveSlotRequest = z.object({ id: z.string().min(1) });
export type OpenSaveSlotRequest = z.infer<typeof OpenSaveSlotRequest>;

export const DeleteSaveSlotRequest = z.object({ id: z.string().min(1) });
export type DeleteSaveSlotRequest = z.infer<typeof DeleteSaveSlotRequest>;

export const ListSaveSlotsResponse = z.object({ slots: z.array(SaveSlotSummary) });
export type ListSaveSlotsResponse = z.infer<typeof ListSaveSlotsResponse>;

export const SaveSlotError = z.object({
  code: z.enum(['DUPLICATE_NAME', 'NOT_FOUND', 'IO_ERROR', 'INVALID_INPUT']),
  message: z.string(),
});
export type SaveSlotError = z.infer<typeof SaveSlotError>;

export const IPC_CHANNELS = {
  create: 'saveSlots:create',
  open: 'saveSlots:open',
  delete: 'saveSlots:delete',
  list: 'saveSlots:list',
} as const;
