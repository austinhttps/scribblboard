import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { CanvasElement, Collaborator, CommentThread, CommentReply, ReactionItem } from '../types/whiteboard';

const USER_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#14b8a6', // Teal
];

const USER_NAMES = [
  'Creative Fox',
  'Design Panda',
  'Product Wizard',
  'Marketing Pro',
  'Studio Artist',
  'Brainstormer',
  'Visionary Owl',
  'Collaborator',
];

/**
 * Manages the Yjs Document, IndexedDB persistence, WebSocket real-time sync, peer awareness, reactions, and threaded comments.
 */
export class WhiteboardService {
  private doc: Y.Doc | null = null;
  private indexeddbProvider: IndexeddbPersistence | null = null;
  private wsProvider: WebsocketProvider | null = null;
  private elementsMap: Y.Map<CanvasElement> | null = null;
  private commentsMap: Y.Map<CommentThread> | null = null;
  private metaMap: Y.Map<any> | null = null;
  private undoManager: Y.UndoManager | null = null;
  private currentBoardId: string = '';
  private isLoaded: boolean = false;
  private isConnected: boolean = false;
  private localUser: { name: string; color: string; id: string };

  private loadListeners: Set<(isLoaded: boolean) => void> = new Set();
  private changeListeners: Set<(elements: CanvasElement[]) => void> = new Set();
  private commentListeners: Set<(comments: CommentThread[]) => void> = new Set();
  private boardNameListeners: Set<(name: string) => void> = new Set();
  private collaboratorListeners: Set<(collaborators: Collaborator[]) => void> = new Set();
  private connectionListeners: Set<(isConnected: boolean) => void> = new Set();

  constructor() {
    // Generate or retrieve persistent user identity for this browser
    const storedName = localStorage.getItem('collab_user_name');
    const storedColor = localStorage.getItem('collab_user_color');
    let storedId = localStorage.getItem('collab_user_id');

    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('collab_user_id', storedId);
    }

    const name = storedName || USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
    const color = storedColor || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

    localStorage.setItem('collab_user_name', name);
    localStorage.setItem('collab_user_color', color);

    this.localUser = { id: storedId, name, color };
  }

  /**
   * Extract board UUID from current URL or generate a new one.
   */
  public getOrCreateBoardId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    let boardId = urlParams.get('board');

    if (!boardId || boardId.trim() === '') {
      boardId = crypto.randomUUID();
      sessionStorage.setItem(`is_creator_${boardId}`, 'true');
      this.updateUrl(boardId);
    }

    return boardId;
  }

  /**
   * Check if the current user created this board in this session
   */
  public isBoardCreator(boardId: string): boolean {
    return sessionStorage.getItem(`is_creator_${boardId}`) === 'true';
  }

  /**
   * Update the browser URL without reloading the page.
   */
  public updateUrl(boardId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('board', boardId);
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * Initialize or switch to a board document with IndexedDB persistence & WebSocket real-time sync.
   */
  public initBoard(boardId: string): void {
    if (this.currentBoardId === boardId && this.doc) {
      return;
    }

    // Clean up previous instance
    this.cleanup();

    this.currentBoardId = boardId;
    this.isLoaded = false;
    this.isConnected = false;
    this.notifyLoadListeners(false);
    this.notifyConnectionListeners(false);

    // 1. Create Yjs Document
    this.doc = new Y.Doc();

    // 2. Obtain shared maps for canvas elements, comments & metadata
    this.elementsMap = this.doc.getMap<CanvasElement>('canvas-elements');
    this.commentsMap = this.doc.getMap<CommentThread>('canvas-comments');
    this.metaMap = this.doc.getMap('board-metadata');

    // 3. Connect local persistence with IndexedDB
    const dbName = `whiteboard-board-${boardId}`;
    this.indexeddbProvider = new IndexeddbPersistence(dbName, this.doc);

    // Handle IndexedDB load event
    this.indexeddbProvider.on('synced', () => {
      this.isLoaded = true;
      this.notifyLoadListeners(true);
      this.notifyChangeListeners();
      this.notifyCommentListeners();
      this.notifyBoardNameListeners();
    });

    // 4. Connect Real-time WebSocket Provider for instant live multi-user collaboration
    const roomName = `collab-board-v3-${boardId}`;
    
    this.wsProvider = new WebsocketProvider(
      'wss://demos.yjs.dev/ws',
      roomName,
      this.doc,
      { connect: true }
    );

    // Setup User Presence & Awareness
    this.wsProvider.awareness.setLocalStateField('user', {
      name: this.localUser.name,
      color: this.localUser.color,
    });

    this.wsProvider.on('status', ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      const connected = status === 'connected';
      this.isConnected = connected;
      this.notifyConnectionListeners(connected);
    });

    this.wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        this.isLoaded = true;
        this.notifyLoadListeners(true);
        this.notifyChangeListeners();
        this.notifyCommentListeners();
        this.notifyBoardNameListeners();
      }
    });

    // Listen to Peer Awareness updates (collaborators & live cursors)
    this.wsProvider.awareness.on('change', () => {
      this.notifyCollaboratorListeners();
    });

    // 5. Initialize UndoManager scoped to elementsMap
    this.undoManager = new Y.UndoManager(this.elementsMap, {
      trackedOrigins: new Set([null, undefined, 'local']),
    });

    // 6. Subscribe to CRDT state changes
    this.elementsMap.observe(() => {
      this.notifyChangeListeners();
    });

    this.commentsMap.observe(() => {
      this.notifyCommentListeners();
    });

    this.metaMap.observe(() => {
      this.notifyBoardNameListeners();
    });
  }

  /**
   * Get board title name
   */
  public getBoardName(): string {
    if (!this.metaMap) return 'New Whiteboard';
    return (this.metaMap.get('boardName') as string) || 'New Whiteboard';
  }

  /**
   * Update board title name
   */
  public setBoardName(name: string): void {
    if (!this.doc || !this.metaMap) return;
    this.doc.transact(() => {
      this.metaMap!.set('boardName', name || 'New Whiteboard');
    }, 'local');
    this.notifyBoardNameListeners();
  }

  /**
   * Check if this board was already initialized
   */
  public isBoardInitialized(): boolean {
    if (!this.metaMap) return false;
    return Boolean(this.metaMap.get('initialized'));
  }

  /**
   * Mark board as initialized so demo objects won't be re-added on clear
   */
  public setBoardInitialized(initialized: boolean = true): void {
    if (!this.doc || !this.metaMap) return;
    this.doc.transact(() => {
      this.metaMap!.set('initialized', initialized);
    }, 'local');
  }

  /**
   * Update local cursor position for awareness broadcast to peers
   */
  public updateCursor(pos: { x: number; y: number } | null): void {
    if (!this.wsProvider) return;
    this.wsProvider.awareness.setLocalStateField('cursor', pos);
  }

  /**
   * Update local user name
   */
  public updateUserName(name: string): void {
    this.localUser.name = name;
    localStorage.setItem('collab_user_name', name);
    if (this.wsProvider) {
      this.wsProvider.awareness.setLocalStateField('user', {
        name: this.localUser.name,
        color: this.localUser.color,
      });
    }
  }

  public getLocalUser(): { name: string; color: string; id: string } {
    return this.localUser;
  }

  /**
   * Get active remote collaborators
   */
  public getCollaborators(): Collaborator[] {
    if (!this.wsProvider) return [];

    const states = this.wsProvider.awareness.getStates();
    const collaborators: Collaborator[] = [];
    const localClientId = this.doc?.clientID;

    states.forEach((state: any, clientId: number) => {
      if (clientId !== localClientId && state.user) {
        collaborators.push({
          clientId,
          name: state.user.name || 'Collaborator',
          color: state.user.color || '#6366f1',
          cursor: state.cursor || undefined,
        });
      }
    });

    return collaborators;
  }

  /**
   * Clean up document and providers when switching boards or unmounting.
   */
  public cleanup(): void {
    if (this.wsProvider) {
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    if (this.indexeddbProvider) {
      this.indexeddbProvider.destroy();
      this.indexeddbProvider = null;
    }
    if (this.undoManager) {
      this.undoManager.destroy();
      this.undoManager = null;
    }
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.elementsMap = null;
    this.commentsMap = null;
    this.metaMap = null;
    this.isLoaded = false;
    this.isConnected = false;
  }

  /**
   * Get all elements as a sorted array by zIndex and timestamp.
   */
  public getElements(): CanvasElement[] {
    if (!this.elementsMap) return [];
    const elements: CanvasElement[] = [];
    this.elementsMap.forEach((element) => {
      if (element && element.id) {
        elements.push(element);
      }
    });
    return elements.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  /**
   * Set or update an element in the CRDT document.
   */
  public setElement(element: CanvasElement, origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      this.elementsMap!.set(element.id, {
        ...element,
        updatedAt: Date.now(),
      });
      this.metaMap?.set('initialized', true);
    }, origin);
  }

  /**
   * Batch set multiple elements in a single CRDT transaction.
   * Guarantees atomic multiplayer sync and single-step undo/redo.
   */
  public setElements(elements: CanvasElement[], origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap || elements.length === 0) return;

    this.doc.transact(() => {
      elements.forEach((element) => {
        this.elementsMap!.set(element.id, {
          ...element,
          updatedAt: Date.now(),
        });
      });
      this.metaMap?.set('initialized', true);
    }, origin);
  }

  /**
   * Alias for setElements to ensure consistent naming across hooks and services.
   */
  public setBatchElements(elements: CanvasElement[], origin: string = 'local'): void {
    this.setElements(elements, origin);
  }

  /**
   * Execute an arbitrary block of CRDT mutations inside a single atomic transaction.
   */
  public transact(fn: () => void, origin: string = 'local'): void {
    if (!this.doc) return;
    this.doc.transact(fn, origin);
  }

  /**
   * Toggle emoji reaction on an element
   */
  public toggleReaction(elementId: string, emoji: string): void {
    if (!this.doc || !this.elementsMap) return;

    const element = this.elementsMap.get(elementId);
    if (!element) return;

    const currentReactions = Array.isArray(element.reactions) ? [...element.reactions] : [];
    const userId = this.localUser.id;
    const existingIndex = currentReactions.findIndex(
      (r) => r.emoji === emoji && r.userId === userId
    );

    let updatedReactions: ReactionItem[];
    if (existingIndex >= 0) {
      // Remove reaction
      updatedReactions = currentReactions.filter((_, idx) => idx !== existingIndex);
    } else {
      // Add reaction
      updatedReactions = [
        ...currentReactions,
        {
          id: crypto.randomUUID(),
          emoji,
          userId,
          userName: this.localUser.name,
          createdAt: Date.now(),
        },
      ];
    }

    this.setElement({
      ...element,
      reactions: updatedReactions,
    });
  }

  /**
   * Threaded Comments Management
   */
  public getComments(): CommentThread[] {
    if (!this.commentsMap) return [];
    const comments: CommentThread[] = [];
    this.commentsMap.forEach((comment) => {
      if (comment && comment.id) {
        comments.push(comment);
      }
    });
    return comments.sort((a, b) => a.createdAt - b.createdAt);
  }

  public addComment(elementId: string, text: string): string | null {
    if (!this.doc || !this.commentsMap) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const commentId = crypto.randomUUID();
    const newComment: CommentThread = {
      id: commentId,
      elementId,
      author: this.localUser.name,
      authorColor: this.localUser.color,
      text: trimmed,
      createdAt: Date.now(),
      replies: [],
      resolved: false,
    };

    this.doc.transact(() => {
      this.commentsMap!.set(commentId, newComment);
    }, 'local');

    return commentId;
  }

  public addReply(commentId: string, text: string): void {
    if (!this.doc || !this.commentsMap) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const thread = this.commentsMap.get(commentId);
    if (!thread) return;

    const newReply: CommentReply = {
      id: crypto.randomUUID(),
      author: this.localUser.name,
      authorColor: this.localUser.color,
      text: trimmed,
      createdAt: Date.now(),
    };

    const updatedThread: CommentThread = {
      ...thread,
      replies: [...(thread.replies || []), newReply],
    };

    this.doc.transact(() => {
      this.commentsMap!.set(commentId, updatedThread);
    }, 'local');
  }

  public deleteComment(commentId: string): void {
    if (!this.doc || !this.commentsMap) return;
    this.doc.transact(() => {
      this.commentsMap!.delete(commentId);
    }, 'local');
  }

  public toggleResolveComment(commentId: string): void {
    if (!this.doc || !this.commentsMap) return;
    const thread = this.commentsMap.get(commentId);
    if (!thread) return;

    const updatedThread: CommentThread = {
      ...thread,
      resolved: !thread.resolved,
    };

    this.doc.transact(() => {
      this.commentsMap!.set(commentId, updatedThread);
    }, 'local');
  }

  /**
   * Remove an element by ID (guards against deleting locked elements).
   */
  public deleteElement(id: string, origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;
    const el = this.elementsMap.get(id);
    if (el?.locked) return;

    this.doc.transact(() => {
      this.elementsMap!.delete(id);
      this.metaMap?.set('initialized', true);
    }, origin);
  }

  /**
   * Delete multiple elements by IDs (filters out locked elements).
   */
  public deleteElements(ids: string[], origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      ids.forEach((id) => {
        const el = this.elementsMap!.get(id);
        if (!el?.locked) {
          this.elementsMap!.delete(id);
        }
      });
      this.metaMap?.set('initialized', true);
    }, origin);
  }

  /**
   * Clear all elements from board without resetting metadata.
   */
  public clearAll(origin: string = 'local'): void {
    if (!this.doc || !this.elementsMap) return;

    this.doc.transact(() => {
      const keys = Array.from(this.elementsMap!.keys());
      keys.forEach((key) => this.elementsMap!.delete(key));
      if (this.commentsMap) {
        const commentKeys = Array.from(this.commentsMap.keys());
        commentKeys.forEach((key) => this.commentsMap!.delete(key));
      }
      this.metaMap?.set('initialized', true);
    }, origin);
  }

  /**
   * Undo last operation.
   */
  public undo(): boolean {
    if (this.undoManager && this.undoManager.undoStack.length > 0) {
      this.undoManager.undo();
      return true;
    }
    return false;
  }

  /**
   * Redo previously undone operation.
   */
  public redo(): boolean {
    if (this.undoManager && this.undoManager.redoStack.length > 0) {
      this.undoManager.redo();
      return true;
    }
    return false;
  }

  public canUndo(): boolean {
    return (this.undoManager?.undoStack.length ?? 0) > 0;
  }

  public canRedo(): boolean {
    return (this.undoManager?.redoStack.length ?? 0) > 0;
  }

  /**
   * Get current highest zIndex to layer new elements on top.
   */
  public getNextZIndex(): number {
    const elements = this.getElements();
    if (elements.length === 0) return 1;
    const maxZ = Math.max(...elements.map((el) => el.zIndex ?? 0));
    return maxZ + 1;
  }

  /**
   * Subscribe to element changes.
   */
  public subscribe(listener: (elements: CanvasElement[]) => void): () => void {
    this.changeListeners.add(listener);
    listener(this.getElements());
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /**
   * Subscribe to comments changes.
   */
  public subscribeComments(listener: (comments: CommentThread[]) => void): () => void {
    this.commentListeners.add(listener);
    listener(this.getComments());
    return () => {
      this.commentListeners.delete(listener);
    };
  }

  /**
   * Subscribe to loading/sync state.
   */
  public subscribeLoading(listener: (isLoaded: boolean) => void): () => void {
    this.loadListeners.add(listener);
    listener(this.isLoaded);
    return () => {
      this.loadListeners.delete(listener);
    };
  }

  /**
   * Subscribe to WebSocket connection state.
   */
  public subscribeConnection(listener: (isConnected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  /**
   * Subscribe to collaborator awareness list.
   */
  public subscribeCollaborators(listener: (collaborators: Collaborator[]) => void): () => void {
    this.collaboratorListeners.add(listener);
    listener(this.getCollaborators());
    return () => {
      this.collaboratorListeners.delete(listener);
    };
  }

  /**
   * Subscribe to board name changes.
   */
  public subscribeBoardName(listener: (name: string) => void): () => void {
    this.boardNameListeners.add(listener);
    listener(this.getBoardName());
    return () => {
      this.boardNameListeners.delete(listener);
    };
  }

  private notifyChangeListeners(): void {
    const elements = this.getElements();
    this.changeListeners.forEach((listener) => listener(elements));
  }

  private notifyCommentListeners(): void {
    const comments = this.getComments();
    this.commentListeners.forEach((listener) => listener(comments));
  }

  private notifyBoardNameListeners(): void {
    const name = this.getBoardName();
    this.boardNameListeners.forEach((listener) => listener(name));
  }

  private notifyLoadListeners(isLoaded: boolean): void {
    this.loadListeners.forEach((listener) => listener(isLoaded));
  }

  private notifyConnectionListeners(isConnected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(isConnected));
  }

  private notifyCollaboratorListeners(): void {
    const collaborators = this.getCollaborators();
    this.collaboratorListeners.forEach((listener) => listener(collaborators));
  }

  public getBoardId(): string {
    return this.currentBoardId;
  }

  public isReady(): boolean {
    return this.isLoaded;
  }

  public getElementsMap(): Y.Map<CanvasElement> | null {
    return this.elementsMap;
  }

  public getUndoManager(): Y.UndoManager | null {
    return this.undoManager;
  }

  public getDoc(): Y.Doc | null {
    return this.doc;
  }
}

export const whiteboardService = new WhiteboardService();
