import React from 'react';
import { EXTENSION_NAME } from '@/shared/constants';

export default function App(): React.ReactElement {
  return (
    <div className="flex h-[560px] w-[400px] select-none flex-col overflow-hidden bg-background p-4 text-text">
      <header className="border-muted/20 flex items-center justify-between border-b pb-3">
        <h1 className="text-lg font-bold tracking-tight">{EXTENSION_NAME}</h1>
        <span className="bg-primary/10 rounded-full px-2 py-0.5 text-xs font-medium text-primary">
          v0.1.0
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="bg-primary/10 mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-primary">
          UIU
        </div>
        <h2 className="mb-1 text-sm font-semibold text-text">UIU Notification Initialized</h2>
        <p className="max-w-[280px] text-xs text-muted">
          Extension core is active. Portals: UCAM and ELMS.
        </p>
      </main>

      <footer className="border-muted/20 border-t pt-2 text-center">
        <p className="text-[11px] text-muted">All data stays local on your device.</p>
      </footer>
    </div>
  );
}
