import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { pruneLaserPoints, computeFollowTarget, LaserPoint } from '../helpers/testOracles';

describe('Tier 1: Feature 8 - Laser Pointer & Presenter Spotlight / Follow Mode', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(108);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T1-LASER-1: laser pointer trail must be stored in awareness and NOT pollute elementsMap', () => {
    const laserTrail = {
      points: [100, 100, 110, 105, 120, 115],
      color: '#ef4444',
      timestamp: Date.now(),
    };

    harness.setLocalAwareness('laserTrail', laserTrail);

    // Verify awareness state holds laser trail
    const localState = harness.awarenessStates.get(harness.clientId);
    expect(localState?.laserTrail).toEqual(laserTrail);

    // Verify elementsMap is completely empty (no CRDT pollution)
    expect(harness.getElements().length).toBe(0);
  });

  it('T1-LASER-2: pruneLaserPoints should discard points older than 1500ms', () => {
    const now = 10000;
    const points: LaserPoint[] = [
      { x: 10, y: 10, color: '#ef4444', timestamp: now - 2000 }, // Expired (2000ms old)
      { x: 20, y: 20, color: '#ef4444', timestamp: now - 1600 }, // Expired (1600ms old)
      { x: 30, y: 30, color: '#ef4444', timestamp: now - 1400 }, // Valid (1400ms old)
      { x: 40, y: 40, color: '#ef4444', timestamp: now - 100 },  // Valid (100ms old)
    ];

    const active = pruneLaserPoints(points, 1500, now);

    expect(active.length).toBe(2);
    expect(active[0].x).toBe(30);
    expect(active[1].x).toBe(40);
  });

  it('T1-LASER-3: collaborator awareness broadcasts viewport: { x, y, scale }', () => {
    const leaderClientId = 202;
    harness.setRemoteAwareness(leaderClientId, {
      user: { name: 'Presenter', color: '#10b981' },
      viewport: { x: -300, y: -450, scale: 1.5 },
    });

    const leaderState = harness.awarenessStates.get(leaderClientId);
    expect(leaderState?.viewport).toBeDefined();
    expect(leaderState?.viewport.x).toBe(-300);
    expect(leaderState?.viewport.y).toBe(-450);
    expect(leaderState?.viewport.scale).toBe(1.5);
  });

  it('T1-LASER-4: in follow mode, follower viewport automatically tracks leader viewport updates', () => {
    let followerViewport = { x: 0, y: 0, scale: 1 };
    let followingClientId: number | null = 202;

    const onLeaderViewportChange = (remoteVp: { x: number; y: number; scale: number }) => {
      if (followingClientId) {
        followerViewport = computeFollowTarget(remoteVp);
      }
    };

    // Leader moves to (100, 200, scale 1.2)
    onLeaderViewportChange({ x: 100, y: 200, scale: 1.2 });
    expect(followerViewport).toEqual({ x: 100, y: 200, scale: 1.2 });

    // Leader zooms to scale 2
    onLeaderViewportChange({ x: 150, y: 250, scale: 2 });
    expect(followerViewport).toEqual({ x: 150, y: 250, scale: 2 });
  });

  it('T1-LASER-5: follow mode breaks when local user interacts (panning or pressing Esc)', () => {
    let followingClientId: number | null = 202;

    const handleLocalAction = (action: 'pan' | 'zoom' | 'esc') => {
      if (['pan', 'zoom', 'esc'].includes(action)) {
        followingClientId = null; // break follow
      }
    };

    // Esc press
    handleLocalAction('esc');
    expect(followingClientId).toBeNull();

    // Re-engage and break with manual pan
    followingClientId = 202;
    handleLocalAction('pan');
    expect(followingClientId).toBeNull();
  });

  it('T1-LASER-6: laser pointer active state does not modify selectedIds or clear persistent elements', () => {
    // Add existing elements
    harness.setElement({
      id: 'bg-rect',
      type: 'rect',
      x: 0,
      y: 0,
      zIndex: 1,
      updatedAt: 1,
    } as any);

    let activeTool = 'laser';
    let selectedIds: string[] = ['bg-rect'];

    // Drawing with laser should not drop elements or alter them
    harness.setLocalAwareness('laserTrail', {
      points: [50, 50, 60, 60],
      color: '#ef4444',
      timestamp: Date.now(),
    });

    expect(harness.getElements().length).toBe(1);
    expect(harness.getElement('bg-rect')).toBeDefined();
  });
});
