import React, { useState, useRef, useEffect } from 'react';

export function DraggableItem({
  item,
  index,
  selectedIdx,
  hasEdit,
  scale,
  r,
  boxTop,
  boxHeight,
  fontsLoaded = true,
  onSelect,
  updateEdit,
  children
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const storedDx = (hasEdit?.pdfDx || 0) * scale;
  const storedDy = (hasEdit?.pdfDy || 0) * scale;

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      setDragOffset({
        x: e.clientX - startPos.current.x,
        y: e.clientY - startPos.current.y
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      // We only commit if it actually moved
      setDragOffset(curr => {
        if (curr.x !== 0 || curr.y !== 0) {
          const finalPdfDx = (hasEdit?.pdfDx || 0) + (curr.x / scale);
          const finalPdfDy = (hasEdit?.pdfDy || 0) + (curr.y / scale);
          updateEdit(hasEdit.pageNum, index, { pdfDx: finalPdfDx, pdfDy: finalPdfDy });
        }
        return { x: 0, y: 0 };
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, scale, hasEdit, index, updateEdit]);

  const handlePointerDown = (e) => {
    if (!hasEdit) return; // Only draggable if it's edited
    // Don't drag if clicking the inline editor itself
    if (e.button !== 0) return; // Only left click
    
    e.stopPropagation(); // Avoid triggering selection closure
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    onSelect(index); // Ensure it's selected while dragging
  };

  const xOffset = storedDx + dragOffset.x;
  const yOffset = storedDy + dragOffset.y;

  return (
    <div
      onClick={(e) => {
        // If fonts aren't loaded yet, completely ignore the click
        if (!fontsLoaded) return;
        
        if (dragOffset.x === 0 && dragOffset.y === 0) {
           e.stopPropagation();
           onSelect(index);
        }
      }}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: r.x,
        top: boxTop,
        width: hasEdit && hasEdit.newStr !== item.str ? 'max-content' : r.w,
        minWidth: r.w,
        height: boxHeight,
        cursor: fontsLoaded ? (isDragging ? 'grabbing' : (hasEdit ? 'grab' : 'text')) : 'wait',
        pointerEvents: 'all',
        backgroundColor: hasEdit || selectedIdx === index ? 'white' : 'transparent',
        display: 'flex',
        alignItems: 'baseline',
        transform: `translate(${xOffset}px, ${yOffset}px)`,
        userSelect: 'none', // Prevent text selection highlight during drag
      }}
      className={`box-border transition-all duration-150 rounded-[3px] ${
        selectedIdx === index
          ? 'opacity-0 pointer-events-none'
          : hasEdit
            ? 'border border-blue-400 bg-white hover:border-blue-600 shadow-sm cursor-pointer'
            : 'border border-dashed border-slate-300/80 dark:border-slate-600/60 bg-blue-50/5 hover:border-blue-500 hover:bg-blue-500/15 hover:shadow-sm cursor-text'
      }`}
      title={hasEdit ? `Edited: ${hasEdit.newStr}` : `Click to Edit Text: "${item.str}"`}
    >
      {children}
    </div>
  );
}

