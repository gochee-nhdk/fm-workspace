import { useState, useCallback } from 'react';
import type { WorkspaceTabType } from './useWorkspaceData';

export function useTableDragAndDrop(
  activeTab: WorkspaceTabType,
  onReorder: (
    type: WorkspaceTabType,
    sourceId: string,
    targetId: string,
    position: 'top' | 'bottom'
  ) => void
) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  const handleDragStart = useCallback((id: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback(
    (id: string, e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedId || draggedId === id) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const isBottom = e.clientY > rect.top + rect.height / 2;
      const pos = isBottom ? 'bottom' : 'top';
      if (dragOverId !== id || dropPosition !== pos) {
        setDragOverId(id);
        setDropPosition(pos);
      }
    },
    [draggedId, dragOverId, dropPosition]
  );

  const handleDragLeave = useCallback(
    (id: string, e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (dragOverId === id) {
        setDragOverId(null);
        setDropPosition(null);
      }
    },
    [dragOverId]
  );

  const handleDrop = useCallback(
    (id: string, e: React.DragEvent) => {
      e.preventDefault();
      if (draggedId && draggedId !== id && dropPosition) {
        onReorder(activeTab, draggedId, id, dropPosition);
      }
      setDraggedId(null);
      setDragOverId(null);
      setDropPosition(null);
    },
    [activeTab, draggedId, dropPosition, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  }, []);

  return {
    draggedId,
    dragOverId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
