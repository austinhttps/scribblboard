import { useEffect, useState, useCallback } from 'react';
import { whiteboardService } from '../services/yjsDoc';
import { CanvasElement, Collaborator, CommentThread } from '../types/whiteboard';

export function useWhiteboard() {
  const [boardId, setBoardId] = useState<string>(() => whiteboardService.getOrCreateBoardId());
  const [boardName, setBoardNameState] = useState<string>('New Whiteboard');
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  useEffect(() => {
    whiteboardService.initBoard(boardId);

    const unsubscribeLoad = whiteboardService.subscribeLoading((loaded) => {
      setIsLoaded(loaded);
    });

    const unsubscribeConnection = whiteboardService.subscribeConnection((connected) => {
      setIsConnected(connected);
    });

    const unsubscribeCollaborators = whiteboardService.subscribeCollaborators((collabs) => {
      setCollaborators(collabs);
    });

    const unsubscribeBoardName = whiteboardService.subscribeBoardName((name) => {
      setBoardNameState(name);
      document.title = `${name} - scribblboard`;
    });

    const unsubscribeElements = whiteboardService.subscribe((updatedElements) => {
      setElements(updatedElements);
      setCanUndo(whiteboardService.canUndo());
      setCanRedo(whiteboardService.canRedo());
    });

    const unsubscribeComments = whiteboardService.subscribeComments((updatedComments) => {
      setComments(updatedComments);
    });

    // Listen for browser popstate (back/forward button)
    const handlePopState = () => {
      const newBoardId = whiteboardService.getOrCreateBoardId();
      setBoardId(newBoardId);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeLoad();
      unsubscribeConnection();
      unsubscribeCollaborators();
      unsubscribeBoardName();
      unsubscribeElements();
      unsubscribeComments();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [boardId]);

  const createNewBoard = useCallback(() => {
    const newId = crypto.randomUUID();
    sessionStorage.setItem(`is_creator_${newId}`, 'true');
    whiteboardService.updateUrl(newId);
    setBoardId(newId);
  }, []);

  const switchBoard = useCallback((targetId: string) => {
    whiteboardService.updateUrl(targetId);
    setBoardId(targetId);
  }, []);

  const setBoardName = useCallback((name: string) => {
    whiteboardService.setBoardName(name);
  }, []);

  const setElement = useCallback((element: CanvasElement) => {
    whiteboardService.setElement(element);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const setBatchElements = useCallback((elementsList: CanvasElement[]) => {
    whiteboardService.setElements(elementsList);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const deleteElement = useCallback((id: string) => {
    whiteboardService.deleteElement(id);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const deleteElements = useCallback((ids: string[]) => {
    whiteboardService.deleteElements(ids);
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const toggleReaction = useCallback((elementId: string, emoji: string) => {
    whiteboardService.toggleReaction(elementId, emoji);
  }, []);

  const addComment = useCallback((elementId: string, text: string) => {
    return whiteboardService.addComment(elementId, text);
  }, []);

  const addReply = useCallback((commentId: string, text: string) => {
    whiteboardService.addReply(commentId, text);
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    whiteboardService.deleteComment(commentId);
  }, []);

  const toggleResolveComment = useCallback((commentId: string) => {
    whiteboardService.toggleResolveComment(commentId);
  }, []);

  const clearAll = useCallback(() => {
    whiteboardService.clearAll();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
  }, []);

  const undo = useCallback(() => {
    const res = whiteboardService.undo();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
    return res;
  }, []);

  const redo = useCallback(() => {
    const res = whiteboardService.redo();
    setCanUndo(whiteboardService.canUndo());
    setCanRedo(whiteboardService.canRedo());
    return res;
  }, []);

  const updateCursor = useCallback((pos: { x: number; y: number } | null) => {
    whiteboardService.updateCursor(pos);
  }, []);

  const updateUserName = useCallback((name: string) => {
    whiteboardService.updateUserName(name);
  }, []);

  return {
    boardId,
    boardName,
    setBoardName,
    elements,
    comments,
    isLoaded,
    isConnected,
    collaborators,
    localUser: whiteboardService.getLocalUser(),
    canUndo,
    canRedo,
    createNewBoard,
    switchBoard,
    setElement,
    setBatchElements,
    deleteElement,
    deleteElements,
    toggleReaction,
    addComment,
    addReply,
    deleteComment,
    toggleResolveComment,
    clearAll,
    undo,
    redo,
    updateCursor,
    updateUserName,
    isBoardInitialized: () => whiteboardService.isBoardInitialized(),
    setBoardInitialized: (val?: boolean) => whiteboardService.setBoardInitialized(val),
    isBoardCreator: () => whiteboardService.isBoardCreator(boardId),
    getNextZIndex: () => whiteboardService.getNextZIndex(),
  };
}
