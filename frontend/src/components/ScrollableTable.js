import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * ScrollableTable - A comprehensive scrollable table wrapper
 *
 * SCROLL APPROACH: CSS-first for reliability
 * - Height and overflow are handled by CSS classes (base.css, admin.css)
 * - This prevents intermittent scroll bugs caused by JS timing issues
 * - Component only provides structure and optional drag-to-scroll
 *
 * Features:
 * - Vertical scroll with CSS max-height (60vh in admin, 500px default)
 * - Horizontal scrollbars (top and bottom, synchronized)
 * - Sticky header support
 * - Visible scrollbar styling for both light/dark modes
 * - Click-and-drag scrolling (grab to pan in any direction)
 *
 * Props:
 * - children: Table element to wrap
 * - className: Additional CSS classes
 * - height: Optional custom max-height (CSS handles default)
 * - stickyHeader: Enable sticky header (default: true)
 * - showTopScrollbar: Show top horizontal scrollbar (default: true)
 */
export default function ScrollableTable({
  children,
  className = '',
  height = null, // Let CSS handle height by default
  stickyHeader = true,
  showTopScrollbar = true
}) {
  const containerRef = useRef(null);
  const tableWrapperRef = useRef(null);
  const topScrollRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Sync horizontal scroll between top scrollbar and table
  const handleTopScroll = useCallback(() => {
    if (tableWrapperRef.current && topScrollRef.current && !isScrolling) {
      setIsScrolling(true);
      tableWrapperRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => setIsScrolling(false));
    }
  }, [isScrolling]);

  const handleTableScroll = useCallback(() => {
    if (tableWrapperRef.current && topScrollRef.current && !isScrolling) {
      setIsScrolling(true);
      topScrollRef.current.scrollLeft = tableWrapperRef.current.scrollLeft;
      requestAnimationFrame(() => setIsScrolling(false));
    }
  }, [isScrolling]);

  // Drag-to-scroll handlers
  const handleMouseDown = useCallback((e) => {
    // Only trigger on left mouse button and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target;
    if (target.closest('a, button, input, select, textarea, [role="button"]')) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: tableWrapperRef.current?.scrollLeft || 0,
      scrollTop: tableWrapperRef.current?.scrollTop || 0
    };

    // Prevent text selection during drag
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !tableWrapperRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    tableWrapperRef.current.scrollLeft = dragStartRef.current.scrollLeft - deltaX;
    tableWrapperRef.current.scrollTop = dragStartRef.current.scrollTop - deltaY;

    // Sync top scrollbar
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableWrapperRef.current.scrollLeft;
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse up listener to handle drag release outside component
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Calculate table width for horizontal scrollbar sync
  useEffect(() => {
    const updateTableWidth = () => {
      if (tableWrapperRef.current) {
        const table = tableWrapperRef.current.querySelector('table');
        if (table) {
          setTableWidth(table.scrollWidth);
        }
      }
    };

    updateTableWidth();

    // Recalculate on window resize
    window.addEventListener('resize', updateTableWidth);

    return () => {
      window.removeEventListener('resize', updateTableWidth);
    };
  }, [children]);

  // Determine if we need to show scrollbars
  const needsHorizontalScroll = tableWidth > 0 && containerRef.current &&
    tableWidth > containerRef.current.offsetWidth;

  return (
    <div
      ref={containerRef}
      className={`scrollable-table-container ${className}`}
    >
      {/* Top horizontal scrollbar - only show if content overflows */}
      {showTopScrollbar && (
        <div
          ref={topScrollRef}
          className="scrollable-table-top-scrollbar"
          onScroll={handleTopScroll}
        >
          <div style={{ width: tableWidth, height: '1px' }} />
        </div>
      )}

      {/* Table wrapper with both horizontal and vertical scroll */}
      {/* Height and overflow are handled by CSS for reliability - see base.css and admin.css */}
      <div
        className={`table-wrapper scrollable-table-wrapper ${stickyHeader ? 'sticky-header' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleTableScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          // Only apply custom height if explicitly provided
          ...(height && { maxHeight: height }),
          // Drag cursor styles
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: isDragging ? 'none' : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  );
}
