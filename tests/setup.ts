import '@testing-library/jest-dom';

// Chrome API mock for tests when running outside browser environment
if (typeof globalThis.chrome === 'undefined') {
  const storageMock = () => {
    let store: Record<string, unknown> = {};
    return {
      get: (
        keys: string | string[] | Record<string, unknown> | null,
        callback?: (items: Record<string, unknown>) => void
      ) => {
        let result: Record<string, unknown> = {};
        if (typeof keys === 'string') {
          result[keys] = store[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) {
            result[k] = store[k];
          }
        } else if (keys === null) {
          result = { ...store };
        } else if (typeof keys === 'object') {
          for (const [k, defaultVal] of Object.entries(keys)) {
            result[k] = store[k] !== undefined ? store[k] : defaultVal;
          }
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set: (items: Record<string, unknown>, callback?: () => void) => {
        store = { ...store, ...items };
        if (callback) callback();
        return Promise.resolve();
      },
      remove: (keys: string | string[], callback?: () => void) => {
        if (typeof keys === 'string') {
          delete store[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) delete store[k];
        }
        if (callback) callback();
        return Promise.resolve();
      },
      clear: (callback?: () => void) => {
        store = {};
        if (callback) callback();
        return Promise.resolve();
      },
    };
  };

  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const eventMock = (name: string) => ({
    addListener: (cb: (...args: unknown[]) => void) => {
      listeners[name] = listeners[name] || [];
      listeners[name].push(cb);
    },
    removeListener: (cb: (...args: unknown[]) => void) => {
      if (listeners[name]) {
        listeners[name] = listeners[name].filter((fn) => fn !== cb);
      }
    },
    hasListener: (cb: (...args: unknown[]) => void) => {
      return listeners[name]?.includes(cb) ?? false;
    },
  });

  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
      sendMessage: () => Promise.resolve(),
      onMessage: eventMock('runtime.onMessage'),
      onInstalled: eventMock('runtime.onInstalled'),
      onStartup: eventMock('runtime.onStartup'),
    },
    storage: {
      local: storageMock(),
      session: storageMock(),
      onChanged: eventMock('storage.onChanged'),
    },
    alarms: {
      create: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      getAll: () => Promise.resolve([]),
      onAlarm: eventMock('alarms.onAlarm'),
    },
    notifications: {
      create: () => Promise.resolve('notif-id'),
      clear: () => Promise.resolve(true),
      onClicked: eventMock('notifications.onClicked'),
      onButtonClicked: eventMock('notifications.onButtonClicked'),
    },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      setTitle: () => Promise.resolve(),
    },
    tabs: {
      create: (props: unknown) => Promise.resolve(props),
    },
    offscreen: {
      createDocument: () => Promise.resolve(),
      closeDocument: () => Promise.resolve(),
      hasDocument: () => Promise.resolve(false),
      Reason: {
        DOM_PARSER: 'DOM_PARSER',
        AUDIO_PLAYBACK: 'AUDIO_PLAYBACK',
      },
    },
  };
}
