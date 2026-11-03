import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import {
  generateStarterTemplate,
  alignElements,
  distributeElements,
  calculateSnapping,
  computeElementBounds,
  moveFrameWithChildren,
  isElementInsideFrame,
  pruneLaserPoints,
  computeFollowTarget,
  FrameElement,
} from '../helpers/testOracles';
import { CanvasElement, StickyElement, RectElement, ArrowElement } from '../../src/types/whiteboard';

describe('Tier 4: Real-World Application Scenarios', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(401);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T4-SCENARIO-1: Sprint Retrospective End-to-End Workflow', () => {
    // 1. Instantiate Sprint Retro template centered at (500, 500)
    const retro = generateStarterTemplate('retro', { x: 500, y: 500 });
    harness.setElements(retro, 'remote');
    harness.undoManager.stopCapturing();

    expect(harness.getElements().length).toBeGreaterThanOrEqual(6);

    // 2. Add custom participant sticky note to "Action items"
    const actionHeader = retro.find((e) => (e as any).text === 'Action items')!;
    const newActionNote: StickyElement = {
      id: 'custom-action-note-1',
      type: 'sticky',
      x: actionHeader.x,
      y: actionHeader.y + 160,
      width: 200,
      height: 120,
      text: 'Automate E2E regression tests',
      color: 'blue',
      fontSize: 14,
      zIndex: 10,
      updatedAt: Date.now(),
    };
    harness.setElement(newActionNote as CanvasElement, 'local');
    harness.undoManager.stopCapturing();

    // 3. Facilitator locks the 3 column headers so participants cannot drag or delete them
    const headers = harness.getElements().filter((e) =>
      ['What went well', 'What could improve', 'Action items'].includes((e as any).text)
    );
    expect(headers.length).toBe(3);

    harness.transact(() => {
      headers.forEach((h) => {
        harness.setElement({ ...h, locked: true }, 'local');
      });
    }, 'local');
    harness.undoManager.stopCapturing();

    headers.forEach((h) => {
      expect((harness.getElement(h.id) as any).locked).toBe(true);
    });

    // 4. Facilitator groups action notes together
    const actionNotes = harness.getElements().filter((e) =>
      e.id === newActionNote.id || (e as any).text?.includes('Action items')
    );
    const actionGroupId = 'grp-retro-actions';
    harness.transact(() => {
      actionNotes.forEach((an) => {
        harness.setElement({ ...an, groupId: actionGroupId }, 'local');
      });
    }, 'local');

    actionNotes.forEach((an) => {
      expect((harness.getElement(an.id) as any).groupId).toBe(actionGroupId);
    });

    // 5. Undo grouping should revert group association while keeping notes intact
    harness.undo();
    actionNotes.forEach((an) => {
      expect((harness.getElement(an.id) as any).groupId).toBeUndefined();
      expect(harness.getElement(an.id)).toBeDefined();
    });
  });

  it('T4-SCENARIO-2: Kanban Board Lifecycle with Frame Hierarchical Containment', () => {
    // 1. Instantiate Kanban board (To Do, In Progress, Done)
    const kanban = generateStarterTemplate('kanban', { x: 600, y: 400 });
    harness.setElements(kanban, 'remote');
    harness.undoManager.stopCapturing();

    const todoFrame = kanban.find((e) => e.type === 'frame' && (e as any).title === 'To Do') as unknown as FrameElement;
    const inProgressFrame = kanban.find((e) => e.type === 'frame' && (e as any).title === 'In Progress') as unknown as FrameElement;

    expect(todoFrame).toBeDefined();
    expect(inProgressFrame).toBeDefined();

    // 2. Create task card inside "To Do"
    const taskCard: StickyElement = {
      id: 'task-card-auth',
      type: 'sticky',
      x: todoFrame.x + 30,
      y: todoFrame.y + 100,
      width: 200,
      height: 80,
      text: 'Implement Auth0 SSO',
      color: 'yellow',
      fontSize: 14,
      zIndex: 5,
      updatedAt: Date.now(),
    };
    harness.setElement(taskCard as CanvasElement, 'local');
    expect(isElementInsideFrame(taskCard as CanvasElement, todoFrame)).toBe(true);

    // 3. Move task card to "In Progress" frame
    const movedCard: StickyElement = {
      ...taskCard,
      x: inProgressFrame.x + 30,
      y: inProgressFrame.y + 100,
    };
    harness.setElement(movedCard as CanvasElement, 'local');

    expect(isElementInsideFrame(movedCard as CanvasElement, todoFrame)).toBe(false);
    expect(isElementInsideFrame(movedCard as CanvasElement, inProgressFrame)).toBe(true);

    // 4. Moving "In Progress" frame moves the task card with it
    const all = harness.getElements();
    const shifted = moveFrameWithChildren(inProgressFrame, all, 50, 50);
    harness.setElements(shifted, 'local');

    const updatedTask = harness.getElement('task-card-auth')!;
    expect(updatedTask.x).toBe(inProgressFrame.x + 30 + 50);
    expect(updatedTask.y).toBe(inProgressFrame.y + 100 + 50);
  });

  it('T4-SCENARIO-3: Flowchart Creation, Alignment, and Auto-Snapping', () => {
    // 1. Instantiate Flowchart template
    const flowchart = generateStarterTemplate('flowchart', { x: 400, y: 300 });
    harness.setElements(flowchart, 'remote');

    // 2. Add new process step rect
    const newStep: RectElement = {
      id: 'step-validate',
      type: 'rect',
      x: 148, // 2px away from x=150 (flow-p1 is at 400 - 250 = 150)
      y: 500,
      width: 140,
      height: 80,
      fill: '#fed7aa',
      stroke: '#ea580c',
      strokeWidth: 2,
      zIndex: 6,
      updatedAt: Date.now(),
    };

    // Calculate snapping against existing flowchart boxes
    const newStepBounds = computeElementBounds(newStep as CanvasElement);
    const snap = calculateSnapping(newStepBounds, flowchart, 5);

    expect(snap.snappedX).toBe(150); // Snapped to match left box x=150
    expect(snap.guides.length).toBeGreaterThan(0);

    const snappedStep = { ...newStep, x: snap.snappedX };
    harness.setElement(snappedStep as CanvasElement, 'local');

    // 3. Align process boxes horizontally
    const boxes = harness.getElements().filter((e) => e.type === 'rect');
    const aligned = alignElements(boxes, 'center');
    harness.setElements(aligned, 'local');

    const firstCenter = computeElementBounds(aligned[0]).centerX;
    aligned.forEach((b) => {
      expect(Math.abs(computeElementBounds(b).centerX - firstCenter)).toBeLessThan(1);
    });
  });

  it('T4-SCENARIO-4: SWOT Matrix Organization and Locking', () => {
    // 1. Instantiate SWOT matrix (4 quadrants)
    const swot = generateStarterTemplate('swot', { x: 500, y: 500 });
    harness.setElements(swot, 'remote');

    const strengthsQuad = swot.find((e) => (e as any).title === 'Strengths') as unknown as FrameElement;
    expect(strengthsQuad).toBeDefined();

    // 2. Add sticky notes into Strengths quadrant
    const s1: StickyElement = {
      id: 's-note-1',
      type: 'sticky',
      x: strengthsQuad.x + 20,
      y: strengthsQuad.y + 40,
      width: 80,
      height: 40,
      text: 'Fast sync engine',
      color: 'green',
      fontSize: 12,
      zIndex: 5,
      updatedAt: Date.now(),
    };
    const s2: StickyElement = {
      id: 's-note-2',
      type: 'sticky',
      x: strengthsQuad.x + 30,
      y: strengthsQuad.y + 120,
      width: 80,
      height: 40,
      text: 'CRDT conflict-free',
      color: 'green',
      fontSize: 12,
      zIndex: 6,
      updatedAt: Date.now(),
    };
    harness.setElements([s1 as CanvasElement, s2 as CanvasElement], 'local');

    // 3. Lock all 4 SWOT frames to form an immovable background
    harness.transact(() => {
      swot.forEach((q) => {
        harness.setElement({ ...q, locked: true }, 'local');
      });
    }, 'local');

    swot.forEach((q) => {
      expect((harness.getElement(q.id) as any).locked).toBe(true);
    });

    // 4. Align items within Strengths quadrant
    const quadrantNotes = [harness.getElement('s-note-1')!, harness.getElement('s-note-2')!];
    const alignedNotes = alignElements(quadrantNotes, 'left');
    harness.setElements(alignedNotes, 'local');

    expect(alignedNotes[0].x).toBe(strengthsQuad.x + 20);
    expect(alignedNotes[1].x).toBe(strengthsQuad.x + 20);
    // Sticky notes remain unlocked
    expect((harness.getElement('s-note-1') as any).locked).toBeFalsy();
  });

  it('T4-SCENARIO-5: Multi-User Presentation Session with Laser and Spotlight', () => {
    const presenterId = 9001;
    const collaboratorId = 9002;

    // 1. Presenter broadcasts initial viewport in awareness
    harness.setRemoteAwareness(presenterId, {
      user: { name: 'Lead Architect', color: '#6366f1' },
      viewport: { x: -100, y: -200, scale: 1.0 },
      laserTrail: null,
    });

    // 2. Collaborator joins and starts following presenter
    let followerTargetId: number | null = presenterId;
    let followerViewport = { x: 0, y: 0, scale: 1.0 };

    // Follower syncs viewport to leader
    const presenterState = harness.awarenessStates.get(presenterId)!;
    followerViewport = computeFollowTarget(presenterState.viewport);
    expect(followerViewport).toEqual({ x: -100, y: -200, scale: 1.0 });

    // 3. Presenter draws laser pointer trail
    const now = Date.now();
    const laserPoints = [
      { x: 150, y: 150, color: '#ef4444', timestamp: now },
      { x: 180, y: 190, color: '#ef4444', timestamp: now + 50 },
      { x: 220, y: 240, color: '#ef4444', timestamp: now + 100 },
    ];
    harness.setRemoteAwareness(presenterId, {
      ...presenterState,
      laserTrail: { points: laserPoints, timestamp: now + 100 },
    });

    // Follower sees laser trail in awareness, persistent canvas has 0 elements
    expect(harness.awarenessStates.get(presenterId)?.laserTrail.points.length).toBe(3);
    expect(harness.getElements().length).toBe(0);

    // 4. Laser points fade out after 1.5s
    const activePoints = pruneLaserPoints(laserPoints, 1500, now + 2000);
    expect(activePoints.length).toBe(0);

    // 5. Presenter pans to examine a frame at (-600, -800, scale 1.5)
    harness.setRemoteAwareness(presenterId, {
      user: { name: 'Lead Architect', color: '#6366f1' },
      viewport: { x: -600, y: -800, scale: 1.5 },
    });
    followerViewport = computeFollowTarget(harness.awarenessStates.get(presenterId)!.viewport);
    expect(followerViewport).toEqual({ x: -600, y: -800, scale: 1.5 });

    // 6. Collaborator presses Esc to break follow mode
    const handleKey = (key: string) => {
      if (key === 'Escape') followerTargetId = null;
    };
    handleKey('Escape');
    expect(followerTargetId).toBeNull();
  });

  it('T4-SCENARIO-6: Real-time Multi-User Collaborative Brainstorm and Cleanup', () => {
    // 3 peers concurrently add stickies
    const user1Note: StickyElement = { id: 'u1-note', type: 'sticky', x: 50, y: 100, width: 80, height: 60, text: 'Idea 1', color: 'yellow', fontSize: 14, zIndex: 1, updatedAt: 1 };
    const user2Note: StickyElement = { id: 'u2-note', type: 'sticky', x: 220, y: 150, width: 80, height: 60, text: 'Idea 2', color: 'pink', fontSize: 14, zIndex: 2, updatedAt: 2 };
    const user3Note: StickyElement = { id: 'u3-note', type: 'sticky', x: 380, y: 90, width: 80, height: 60, text: 'Idea 3', color: 'blue', fontSize: 14, zIndex: 3, updatedAt: 3 };

    harness.setElements([user1Note as CanvasElement, user2Note as CanvasElement, user3Note as CanvasElement], 'remote');
    harness.undoManager.stopCapturing();

    expect(harness.getElements().length).toBe(3);

    // Moderator cleans up: Align Top + Distribute Horizontally
    const notes = harness.getElements();
    const topAligned = alignElements(notes, 'top');
    const distributed = distributeElements(topAligned, 'horizontal');

    harness.setElements(distributed, 'local');

    // All should share exact same Y
    expect(distributed[0].y).toBe(distributed[1].y);
    expect(distributed[1].y).toBe(distributed[2].y);

    // Lock the finalized row
    harness.transact(() => {
      distributed.forEach((d) => {
        harness.setElement({ ...d, locked: true });
      });
    });

    distributed.forEach((d) => {
      expect((harness.getElement(d.id) as any).locked).toBe(true);
    });
  });
});
