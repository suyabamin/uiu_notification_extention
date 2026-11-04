import { describe, it, expect, beforeEach } from 'vitest';
import { LoggerService, redactSensitiveText, sanitizeContext } from './logger';

describe('Logger redaction & sanitization', () => {
  it('redacts tokens, cookies, sesskey, ViewState, and student IDs from messages', () => {
    const raw = 'Failed with sesskey=xyz123 and __VIEWSTATE=dGhpc2lzYXZpZXdzdGF0ZQ== for student 011211045';
    const clean = redactSensitiveText(raw);

    expect(clean).not.toContain('xyz123');
    expect(clean).not.toContain('dGhpc2lzYXZpZXdzdGF0ZQ==');
    expect(clean).not.toContain('011211045');
    expect(clean).toContain('[REDACTED]');
  });

  it('redacts password, token, and cookie fields in context objects', () => {
    const ctx = {
      user: 'test',
      password: 'secretPassword123',
      cookieHeader: 'MoodleSession=abc; sessionid=123',
      htmlContent: '<html><body>Secret page</body></html>',
    };
    const sanitized = sanitizeContext(ctx);

    expect(sanitized?.user).toBe('test');
    expect(sanitized?.password).toBe('[REDACTED]');
    expect(sanitized?.cookieHeader).toBe('[REDACTED]');
    expect(sanitized?.htmlContent).toBe('[REDACTED]');
  });
});

describe('LoggerService ring buffer', () => {
  let logService: LoggerService;

  beforeEach(async () => {
    logService = new LoggerService();
    await logService.clear();
  });

  it('stores log entries and retrieves them', async () => {
    await logService.info('Check started', { cycle: 1 }, 'elms');
    await logService.warn('Latency high', undefined, 'ucam');

    const logs = await logService.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe('Latency high'); // newest first
    expect(logs[1].message).toBe('Check started');
    expect(logs[1].portal).toBe('elms');
  });

  it('caps ring buffer at 200 items', async () => {
    for (let i = 0; i < 210; i++) {
      await logService.info(`Log message ${i}`);
    }

    const logs = await logService.getLogs();
    expect(logs.length).toBe(200);
    expect(logs[0].message).toBe('Log message 209');
  });

  it('clears logs', async () => {
    await logService.info('Temporary log');
    expect((await logService.getLogs()).length).toBe(1);

    await logService.clear();
    expect((await logService.getLogs()).length).toBe(0);
  });
});
