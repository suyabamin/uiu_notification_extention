import { describe, it, expect } from 'vitest';
import { applyJitter, clampInterval, computeEffectiveInterval } from './scheduler';
import { SCHEDULER_CONFIG } from '@/shared/constants';

describe('Scheduler jitter and clamping', () => {
  it('never allows interval below the minimum of 10 minutes', () => {
    for (let i = 0; i < 100; i++) {
      const result = computeEffectiveInterval(5); // below floor
      expect(result).toBeGreaterThanOrEqual(SCHEDULER_CONFIG.MINIMUM_INTERVAL_MINUTES);
    }
  });

  it('applies jitter within ±20% of given interval', () => {
    const base = 15;
    const jitterRatio = SCHEDULER_CONFIG.JITTER_RATIO;
    const min = base * (1 - jitterRatio);
    const max = base * (1 + jitterRatio);

    for (let i = 0; i < 100; i++) {
      const jittered = applyJitter(base);
      expect(jittered).toBeGreaterThanOrEqual(min - 0.001);
      expect(jittered).toBeLessThanOrEqual(max + 0.001);
    }
  });

  it('clamps interval at minimum boundary', () => {
    expect(clampInterval(5)).toBe(10);
    expect(clampInterval(10)).toBe(10);
    expect(clampInterval(15)).toBe(15);
    expect(clampInterval(60)).toBe(60);
  });

  it('effectiveInterval for 15 min stays in [10, 18] after jitter and clamping', () => {
    for (let i = 0; i < 50; i++) {
      const effective = computeEffectiveInterval(15);
      expect(effective).toBeGreaterThanOrEqual(10);
      expect(effective).toBeLessThanOrEqual(18.1);
    }
  });

  it('effectiveInterval for 10 min (floor) stays within jitter of 10', () => {
    for (let i = 0; i < 50; i++) {
      const effective = computeEffectiveInterval(10);
      // With jitter applied to 10: [8, 12] but clamped at 10 → [10, 12]
      expect(effective).toBeGreaterThanOrEqual(10);
      expect(effective).toBeLessThanOrEqual(12.1);
    }
  });
});
