// Offscreen document main file (HTML parser host)
// This module runs inside a hidden offscreen document and receives messages from the service worker.
// It parses portal HTML using DOMParser and returns structured JSON.

import { parseHtmlPayloadSchema } from '@/shared/messaging';

type ParseResult<T> = { ok: boolean; items: T[]; warnings: string[]; parserVersion: string };

function handleMessage(
  event: MessageEvent,
  source: MessageEventSource | null
): void {
  if (!event.data || event.data.type !== 'PARSE_HTML') return;

  const parsed = parseHtmlPayloadSchema.safeParse(event.data.payload);
  if (!parsed.success) {
    source?.postMessage({ error: 'Invalid parse payload' }, { targetOrigin: '*' });
    return;
  }

  const { adapterId, pageType, html, url } = parsed.data;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Route to the correct parser based on adapterId and pageType
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- will be typed per adapter
    let result: ParseResult<any>;

    if (adapterId === 'elms') {
      result = parseElmsPage(pageType, doc, url);
    } else if (adapterId === 'ucam') {
      result = parseUcamPage(pageType, doc, url);
    } else {
      result = { ok: false, items: [], warnings: [`Unknown adapterId: ${adapterId}`], parserVersion: '1.0.0' };
    }

    source?.postMessage({ result }, { targetOrigin: '*' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse error';
    source?.postMessage({ error: message }, { targetOrigin: '*' });
  }
}

// Placeholder parsers — will be replaced by fixture-verified implementations in Phase 4/5
function parseElmsPage(
  pageType: string,
  _doc: Document,
  _url: string
): ParseResult<unknown> {
  return {
    ok: true,
    items: [],
    warnings: [`ELMS parser not yet implemented for pageType: ${pageType}`],
    parserVersion: '0.1.0',
  };
}

function parseUcamPage(
  pageType: string,
  _doc: Document,
  _url: string
): ParseResult<unknown> {
  return {
    ok: true,
    items: [],
    warnings: [`UCAM parser not yet implemented for pageType: ${pageType}`],
    parserVersion: '0.1.0',
  };
}

self.addEventListener('message', (event) => {
  handleMessage(event, event.source);
});

// Also handle chrome.runtime.onMessage for the service worker ↔ offscreen bridge
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'PARSE_HTML') return false;

    const parsed = parseHtmlPayloadSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendResponse({ error: 'Invalid parse payload' });
      return false;
    }

    const { adapterId, pageType, html, url } = parsed.data;

    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- will be typed per adapter
      let result: ParseResult<any>;

      if (adapterId === 'elms') {
        result = parseElmsPage(pageType, doc, url);
      } else if (adapterId === 'ucam') {
        result = parseUcamPage(pageType, doc, url);
      } else {
        result = {
          ok: false,
          items: [],
          warnings: [`Unknown adapterId: ${adapterId}`],
          parserVersion: '1.0.0',
        };
      }

      sendResponse({ result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse error';
      sendResponse({ error: message });
    }

    return false;
  });
}
