/**
 * Offscreen document manager.
 * MV3 service workers have no DOMParser; this creates/manages the offscreen document
 * and provides a typed message bridge to send HTML for parsing.
 */

const OFFSCREEN_PATH = 'offscreen/index.html';

let creatingOffscreenPromise: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  // Check if document already exists
  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) return;

  // Guard against concurrent creation
  if (!creatingOffscreenPromise) {
    creatingOffscreenPromise = chrome.offscreen
      .createDocument({
        url: chrome.runtime.getURL(OFFSCREEN_PATH),
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse portal HTML using DOMParser',
      })
      .finally(() => {
        creatingOffscreenPromise = null;
      });
  }

  await creatingOffscreenPromise;
}

export interface ParseHtmlRequest {
  adapterId: 'elms' | 'ucam';
  pageType: string;
  html: string;
  url: string;
}

export type ParseResult<T> = {
  ok: boolean;
  items: T[];
  warnings: string[];
  parserVersion: string;
};

/**
 * Sends HTML to the offscreen document for parsing.
 * Returns the structured result from the parser.
 */
export async function parseHtmlInOffscreen<T>(
  request: ParseHtmlRequest
): Promise<ParseResult<T>> {
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'PARSE_HTML',
        payload: request,
      },
      (response: { result?: ParseResult<T>; error?: string }) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }
        if (response?.result) {
          resolve(response.result);
        } else {
          reject(new Error('No parse result returned from offscreen'));
        }
      }
    );
  });
}
