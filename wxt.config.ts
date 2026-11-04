import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'UIU Notification',
    description:
      'Chrome & Edge extension that watches UCAM and ELMS for UIU students and notifies on changes.',
    version: '0.1.0',
    permissions: ['alarms', 'notifications', 'storage', 'offscreen'],
    host_permissions: ['https://ucam.uiu.ac.bd/*', 'https://elms.uiu.ac.bd/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'",
    },
  },
});
