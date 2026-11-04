import { z } from 'zod';
import { ALLOWED_HOSTS } from './constants';

export const portalIdSchema = z.enum(['elms', 'ucam']);

export const itemKindSchema = z.enum([
  'material',
  'assignment',
  'quiz',
  'announcement',
  'forum_post',
  'grade',
  'event',
  'portal_notification',
  'notice',
  'result',
  'due',
  'routine',
  'watched_page',
]);

export const changeTypeSchema = z.enum(['added', 'modified', 'removed']);
export const prioritySchema = z.enum(['high', 'normal', 'low']);

export const allowedUrlSchema = z.string().refine((url) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      (!parsed.port || parsed.port === '443') &&
      (ALLOWED_HOSTS as readonly string[]).includes(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}, 'URL must be a valid https URL pointing to ucam.uiu.ac.bd or elms.uiu.ac.bd');

export const itemSchema = z.object({
  id: z.string().min(1),
  portal: portalIdSchema,
  kind: itemKindSchema,
  courseId: z.string().optional(),
  courseName: z.string().optional(),
  title: z.string(),
  url: z.string(),
  summary: z.string().max(300).optional(),
  visible: z.boolean().optional(),
  dueAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  hash: z.string().min(1),
});

export const snapshotSchema = z.object({
  portal: portalIdSchema,
  takenAt: z.string().datetime(),
  parserVersion: z.string(),
  items: z.record(z.string(), itemSchema),
  health: z.object({
    ok: z.boolean(),
    warnings: z.array(z.string()),
  }),
});

export const changeDetailSchema = z.object({
  field: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const textDiffSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
});

export const changeSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string(),
  type: changeTypeSchema,
  kind: itemKindSchema,
  portal: portalIdSchema,
  courseName: z.string().optional(),
  title: z.string(),
  url: z.string(),
  priority: prioritySchema,
  detectedAt: z.string().datetime(),
  read: z.boolean(),
  details: z.array(changeDetailSchema).optional(),
  textDiff: textDiffSchema.optional(),
});

export const watchedPageConfigSchema = z.object({
  id: z.string().min(1),
  url: allowedUrlSchema,
  selector: z.string().optional(),
  label: z.string().min(1),
});

export const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format HH:MM'),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format HH:MM'),
});

const defaultKindsMap: Record<z.infer<typeof itemKindSchema>, boolean> = {
  material: true,
  assignment: true,
  quiz: true,
  announcement: true,
  forum_post: true,
  grade: true,
  event: true,
  portal_notification: true,
  notice: true,
  result: true,
  due: true,
  routine: true,
  watched_page: true,
};

export const settingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  intervalMinutes: z.union([z.literal(10), z.literal(15), z.literal(30), z.literal(60)]),
  portals: z.object({
    elms: z.object({ enabled: z.boolean() }),
    ucam: z.object({ enabled: z.boolean() }),
  }),
  watchedCourses: z.union([z.literal('all'), z.array(z.string())]),
  enabledKinds: z.record(itemKindSchema, z.boolean()).default(defaultKindsMap),
  mutedCourses: z.array(z.string()).default([]),
  quietHours: quietHoursSchema,
  sound: z.boolean().default(false),
  hideDetailsInNotifications: z.boolean().default(true),
  language: z.enum(['en', 'bn']).default('en'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  snoozeUntil: z.string().datetime().optional(),
  watchedPages: z.array(watchedPageConfigSchema).default([]),
});

export const portalStateSchema = z.enum([
  'connected',
  'login_required',
  'error',
  'paused',
  'parser_suspect',
]);

export const portalStatusSchema = z.object({
  portal: portalIdSchema,
  state: portalStateSchema,
  lastCheckAt: z.string().datetime().optional(),
  lastSuccessAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
  backoffUntil: z.string().datetime().optional(),
});

export const logEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.enum(['info', 'warn', 'error']),
  portal: portalIdSchema.optional(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const storageMetaSchema = z.object({
  schemaVersion: z.number().int().positive(),
  installedAt: z.string().datetime(),
  baselineDone: z.object({
    elms: z.boolean(),
    ucam: z.boolean(),
  }),
});
