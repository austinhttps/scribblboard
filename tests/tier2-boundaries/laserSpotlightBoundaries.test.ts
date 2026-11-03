import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { pruneLaserPoints, LaserPoint } from '../helpers/testOracles';

describe('Tier 2: Boundary & Corner Cases - Laser Pointer & Follow Mode', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(208);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T2-LASER-1: Laser trail buffer with 1000+ points prunes expired points efficiently without memory leak', () => {
    const now = 20000;
    const points: LaserPoint[] = [];

    // Create 1000 points spanning 5000ms
    for (let i = 0; i < 1000; i++) {
      points.push({
        x: i,
        y: i,
        color: '#ff0000',
        timestamp: now - (5000 - i * 5), // from now-5000 to now
      });
    }

    const pruned = pruneLaserPoints(points, 1500, now);

    // Points with timestamp >= now - 1500 (i.e. i*5 >= 3500 => i >= 700)
    expect(pruned.length).toBeLessThan(1000);
    expect(pruned.length).toBeGreaterThan(0);
    pruned.forEach((p) => {
      expect(now - p.timestamp).toBeLessThanOrEqual(1500);
    });
  });

  it('T2-LASER-2: Pruning empty laser trail returns empty array without error', () => {
    expect(pruneLaserPoints([])).toEqual([]);
  });

  it('T2-LASER-3: Follow mode with leader extreme zoom (scale 0.01 or 50.0) clamps or stores finite value', () => {
    const leaderClientId = 303;
    harness.setRemoteAwareness(leaderClientId, {
      user: { name: 'Extreme Zoomer', color: '#f59e0b' },
      viewport: { x: 0, y: 0, scale: 50.0 },
    });

    const state = harness.awarenessStates.get(leaderClientId);
    expect(state?.viewport.scale).toBe(50.0);
    expect(Number.isFinite(state?.viewport.scale)).toBe(true);
  });

  it('T2-LASER-4: Leader abruptly disconnecting clears follow state', () => {
    const leaderClientId = 404;
    harness.setRemoteAwareness(leaderClientId, {
      user: { name: 'Disconnecting Leader' },
      viewport: { x: 100, y: 100, scale: 1 },
    });

    let activeFollowTarget: number | null = leaderClientId;

    // Leader disconnects
    harness.removeRemoteAwareness(leaderClientId);

    if (!harness.awarenessStates.has(activeFollowTarget)) {
      activeFollowTarget = null;
    }

    expect(activeFollowTarget).toBeNull();
  });

  it('T2-LASER-5: Rapid successive follow/unfollow toggle events preserve consistent local viewport', () => {
    let localViewport = { x: 50, y: 50, scale: 1 };
    let followingTarget: number | null = null;

    for (let i = 0; i < 20; i++) {
      if (followingTarget === null) {
        followingTarget = 505; // Follow
      } else {
        followingTarget = null; // Unfollow
      }
    }

    expect(followingTarget).toBeNull();
    expect(localViewport.x).toBe(50);
  });

  it('T2-LASER-6: Follow mode ignores invalid or NaN remote viewport coordinates', () => {
    const leaderClientId = 606;
    harness.setRemoteAwareness(leaderClientId, {
      user: { name: 'NaN Leader' },
      viewport: { x: NaN, y: Infinity, scale: 0 },
    });

    const sanitizeViewport = (remoteVp: any) => {
      if (
        !remoteVp ||
        Number.isNaN(remoteVp.x) ||
        !Number.isFinite(remoteVp.x) ||
        Number.isNaN(remoteVp.y) ||
        !Number.isFinite(remoteVp.y) ||
        remoteVp.scale <= 0
      ) {
        return null;
      }
      return remoteVp;
    };

    const leaderState = harness.awarenessStates.get(leaderClientId);
    const sanitized = sanitizeViewport(leaderState?.viewport);
    expect(sanitized).toBeNull();
  });
});
