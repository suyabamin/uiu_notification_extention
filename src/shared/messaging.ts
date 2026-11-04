import { z } from 'zod';
import { portalIdSchema, settingsSchema, watchedPageConfigSchema } from './schemas';
import { PortalId, Settings, PortalStatus, Change } from './types';

// Message types
export const MessageType = {
  GET_STATE: 'GET_STATE',
  CHECK_NOW: 'CHECK_NOW',
  MARK_READ: 'MARK_READ',
  SNOOZE: 'SNOOZE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  CLEAR_DATA: 'CLEAR_DATA',
  GET_PORTAL_STATUS: 'GET_PORTAL_STATUS',
  ADD_WATCHED_PAGE: 'ADD_WATCHED_PAGE',
  REMOVE_WATCHED_PAGE: 'REMOVE_WATCHED_PAGE',
  TEST_PARSER: 'TEST_PARSER',
  SIMULATE_CHANGE: 'SIMULATE_CHANGE',
  // Offscreen messaging
  PARSE_HTML: 'PARSE_HTML',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

// Payload schemas
export const markReadPayloadSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export const snoozePayloadSchema = z.object({
  until: z.string().datetime().optional(), // omitted to unsnooze
});

export const updateSettingsPayloadSchema = z.object({
  settings: settingsSchema.partial(),
});

export const addWatchedPagePayloadSchema = z.object({
  page: watchedPageConfigSchema,
});

export const removeWatchedPagePayloadSchema = z.object({
  id: z.string(),
});

export const testParserPayloadSchema = z.object({
  portal: portalIdSchema,
});

export const parseHtmlPayloadSchema = z.object({
  adapterId: z.string(),
  pageType: z.string(),
  html: z.string(),
  url: z.string(),
});

export interface AppStateResponse {
  settings: Settings;
  statuses: Record<PortalId, PortalStatus>;
  changes: Change[];
  unreadCount: number;
  isChecking: boolean;
}

export interface ExtensionMessage<T = unknown> {
  type: MessageTypeValue;
  payload?: T;
}

/**
 * Validates that a message sender is legitimate.
 * Must be internal to this extension (sender.id === chrome.runtime.id).
 */
export function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender || !sender.id) return false;
  return sender.id === chrome.runtime.id;
}

/**
 * Type-safe runtime message sending helper.
 */
export async function sendExtensionMessage<TResponse = unknown, TPayload = unknown>(
  type: MessageTypeValue,
  payload?: TPayload
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
        } else {
          resolve(response as TResponse);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}
