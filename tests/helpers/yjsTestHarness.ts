import * as Y from 'yjs';
import { CanvasElement } from '../../src/types/whiteboard';

/**
 * Headless test harness providing an isolated Y.Doc, CRDT maps, undo manager,
 * and simulated awareness state for multiplayer canvas testing.
 */
export class YjsTestHarness {
  public doc: Y.Doc;
  public elementsMap: Y.Map<CanvasElement>;
  public commentsMap: Y.Map<any>;
  public metaMap: Y.Map<any>;
  public undoManager: Y.UndoManager;
  public clientId: number;
  public awarenessStates: Map<number, Record<string, any>> = new Map();
  private awarenessListeners: Set<() => void> = new Set();

  constructor(clientId: number = 1001) {
    this.clientId = clientId;
    this.doc = new Y.Doc({ clientID: clientId });
    this.elementsMap = this.doc.getMap<CanvasElement>('canvas-elements');
    this.commentsMap = this.doc.getMap('canvas-comments');
    this.metaMap = this.doc.getMap('board-metadata');

    this.undoManager = new Y.UndoManager(this.elementsMap, {
      trackedOrigins: new Set([null, undefined, 'local']),
    });

    this.awarenessStates.set(clientId, {
      user: { name: `User-${clientId}`, color: '#6366f1' },
      cursor: null,
      viewport: { x: 0, y: 0, scale: 1 },
      laserTrail: null,
    });
  }

  public setElement(element: CanvasElement, origin: string = 'local'): void {
    this.doc.transact(() => {
      this.elementsMap.set(element.id, {
        ...element,
        updatedAt: Date.now(),
      });
      this.metaMap.set('initialized', true);
    }, origin);
  }

  public setElements(elements: CanvasElement[], origin: string = 'local'): void {
    this.doc.transact(() => {
      for (const element of elements) {
        this.elementsMap.set(element.id, {
          ...element,
          updatedAt: Date.now(),
        });
      }
      this.metaMap.set('initialized', true);
    }, origin);
  }

  public getElement(id: string): CanvasElement | undefined {
    return this.elementsMap.get(id);
  }

  public getElements(): CanvasElement[] {
    const list: CanvasElement[] = [];
    this.elementsMap.forEach((el) => {
      if (el && el.id) list.push(el);
    });
    return list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  public deleteElement(id: string, origin: string = 'local'): void {
    this.doc.transact(() => {
      this.elementsMap.delete(id);
    }, origin);
  }

  public deleteElements(ids: string[], origin: string = 'local'): void {
    this.doc.transact(() => {
      for (const id of ids) {
        this.elementsMap.delete(id);
      }
    }, origin);
  }

  public clearAll(origin: string = 'local'): void {
    this.doc.transact(() => {
      const keys = Array.from(this.elementsMap.keys());
      for (const k of keys) {
        this.elementsMap.delete(k);
      }
    }, origin);
  }

  public transact(fn: () => void, origin: string = 'local'): void {
    this.doc.transact(fn, origin);
  }

  public undo(): boolean {
    if (this.undoManager.undoStack.length > 0) {
      this.undoManager.undo();
      return true;
    }
    return false;
  }

  public redo(): boolean {
    if (this.undoManager.redoStack.length > 0) {
      this.undoManager.redo();
      return true;
    }
    return false;
  }

  public canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  public setLocalAwareness(field: string, value: any): void {
    const current = this.awarenessStates.get(this.clientId) || {};
    this.awarenessStates.set(this.clientId, {
      ...current,
      [field]: value,
    });
    this.notifyAwareness();
  }

  public setRemoteAwareness(remoteClientId: number, state: Record<string, any>): void {
    this.awarenessStates.set(remoteClientId, state);
    this.notifyAwareness();
  }

  public removeRemoteAwareness(remoteClientId: number): void {
    this.awarenessStates.delete(remoteClientId);
    this.notifyAwareness();
  }

  public onAwarenessChange(fn: () => void): () => void {
    this.awarenessListeners.add(fn);
    return () => this.awarenessListeners.delete(fn);
  }

  private notifyAwareness(): void {
    this.awarenessListeners.forEach((l) => l());
  }

  public cleanup(): void {
    this.undoManager.destroy();
    this.doc.destroy();
    this.awarenessStates.clear();
    this.awarenessListeners.clear();
  }
}
