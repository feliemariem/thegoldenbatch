import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * ScrollableTable - A comprehensive scrollable table wrapper
 *
 * Features:
 * - Vertical scroll with maxRows support
 * - Horizontal scrollbars (top and bottom, synchronized)
 * - Sticky header support
 * - Visible scrollbar styling for both light/dark modes
 * - Proper overflow handling
 * - Click-and-drag scrolling (grab to pan in any direction)
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

  // Calculate table width and container height
  // Use a ref to track the last valid calculated height to prevent flickering
  const lastValidHeightRef = useRef(null);

  useLayoutEffect(() => {
    let rafId = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const updateDimensions = (isRetry = false) => {
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
              let validRowCount = 0;

              for (let i = 0; i < rowsToMeasure; i++) {
                const rowHeight = rows[i].offsetHeight;
                if (rowHeight > 0) {
                  totalRowHeight += rowHeight;
                  validRowCount++;
                }
              }

              // If we got valid measurements
              if (validRowCount > 0 && headerHeight > 0) {
                const avgRowHeight = totalRowHeight / validRowCount;

                // Calculate container height: header + (maxRows * avgRowHeight) + buffer
                const calculatedHeight = headerHeight + (avgRowHeight * maxRows) + 2;

                // Only apply if we have more rows than maxRows
                if (rows.length > maxRows) {
                  lastValidHeightRef.current = calculatedHeight;
                  setContainerHeight(`${calculatedHeight}px`);
                } else {
                  lastValidHeightRef.current = null;
                  setContainerHeight('auto');
                }
              } else if (retryCount < MAX_RETRIES) {
                // Rows aren't rendered yet, schedule a retry with double-RAF
                // to ensure browser has completed layout and paint
                retryCount++;
                rafId = requestAnimationFrame(() => {
                  rafId = requestAnimationFrame(() => {
                    updateDimensions(true);
                  });
                });
              } else if (lastValidHeightRef.current) {
                // Use last valid height as fallback
                setContainerHeight(`${lastValidHeightRef.current}px`);
              }
            } else if (retryCount < MAX_RETRIES) {
              // No rows yet, retry
              retryCount++;
              rafId = requestAnimationFrame(() => {
                rafId = requestAnimationFrame(() => {
                  updateDimensions(true);
                });
              });
            }
          } else {
            setContainerHeight('auto');
          }
        }
      }
    };

    // Use double requestAnimationFrame to ensure DOM is fully painted
    // First RAF waits for next frame, second RAF ensures paint is complete
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        updateDimensions();
      });
    });

    // Recalculate on window resize
    const handleResize = () => {
      retryCount = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          updateDimensions();
        });
      });
    };

    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for dynamic content changes
    let resizeObserver;
    if (tableWrapperRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        retryCount = 0;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = requestAnimationFrame(() => {
            updateDimensions();
          });
        });
      });
      resizeObserver.observe(tableWrapperRef.current);
    }

    // Also observe the table itself for content changes (e.g., when data loads)
    let mutationObserver;
    if (tableWrapperRef.current && typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        retryCount = 0;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = requestAnimationFrame(() => {
            updateDimensions();
          });
        });
      });
      mutationObserver.observe(tableWrapperRef.current, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          maxHeight: containerHeight,
          overflowY: maxRows ? 'auto' : 'visible',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: isDragging ? 'none' : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  );
}
