import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * ScrollableTable - A comprehensive scrollable table wrapper
 *
 * Features:
 * - Vertical scroll with maxRows support
 * - Horizontal scrollbars (top and bottom, synchronized)
 * - Sticky header support
 * - Visible scrollbar styling for both light/dark modes
 * - Proper overflow handling
 *
 * Props:
 * - children: Table element to wrap
 * - className: Additional CSS classes
 * - maxRows: Maximum visible rows before vertical scroll (default: null = no limit)
 * - stickyHeader: Enable sticky header (default: true)
 * - showTopScrollbar: Show top horizontal scrollbar (default: true)
 */
export default function ScrollableTable({
  children,
  className = '',
  maxRows = null,
  stickyHeader = true,
  showTopScrollbar = true
}) {
  const containerRef = useRef(null);
  const tableWrapperRef = useRef(null);
  const topScrollRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState('auto');
  const [isScrolling, setIsScrolling] = useState(false);

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

  // Calculate table width and container height
  useEffect(() => {
    const updateDimensions = () => {
      if (tableWrapperRef.current) {
        const table = tableWrapperRef.current.querySelector('table');
        if (table) {
          setTableWidth(table.scrollWidth);

          // Calculate height based on maxRows
          if (maxRows && maxRows > 0) {
            const rows = table.querySelectorAll('tbody tr');
            const thead = table.querySelector('thead');

            if (rows.length > 0) {
              // Get header height
              const headerHeight = thead ? thead.offsetHeight : 0;

              // Get average row height from first few rows
              let totalRowHeight = 0;
              const rowsToMeasure = Math.min(rows.length, maxRows);
              for (let i = 0; i < rowsToMeasure; i++) {
                totalRowHeight += rows[i].offsetHeight;
              }
              const avgRowHeight = totalRowHeight / rowsToMeasure;

              // Calculate container height: header + (maxRows * avgRowHeight) + buffer
              const calculatedHeight = headerHeight + (avgRowHeight * maxRows) + 2;

              // Only apply if we have more rows than maxRows
              if (rows.length > maxRows) {
                setContainerHeight(`${calculatedHeight}px`);
              } else {
                setContainerHeight('auto');
              }
            }
          } else {
            setContainerHeight('auto');
          }
        }
      }
    };

    // Initial calculation
    updateDimensions();

    // Recalculate on window resize
    window.addEventListener('resize', updateDimensions);

    // Use ResizeObserver for dynamic content changes
    let resizeObserver;
    if (tableWrapperRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(tableWrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [children, maxRows]);

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
      <div
        className={`table-wrapper scrollable-table-wrapper ${stickyHeader ? 'sticky-header' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleTableScroll}
        style={{
          maxHeight: containerHeight,
          overflowY: maxRows ? 'auto' : 'visible'
        }}
      >
        {children}
      </div>
    </div>
  );
}
