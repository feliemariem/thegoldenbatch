import React, { useRef, useState, useEffect } from 'react';

export default function ScrollableTable({ children, className = '', maxRows = 15 }) {
  const tableWrapperRef = useRef(null);
  const topScrollRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(0);

  // Approximate row height (including padding and border)
  const rowHeight = 55;
  // Calculate max height based on number of rows (add extra for header)
  const maxHeight = (maxRows + 1) * rowHeight;

  // Sync horizontal scroll between top scrollbar and table
  const handleTopScroll = () => {
    if (tableWrapperRef.current && topScrollRef.current) {
      tableWrapperRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (tableWrapperRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableWrapperRef.current.scrollLeft;
    }
  };

  // Update table width for top scrollbar
  useEffect(() => {
    const updateWidth = () => {
      if (tableWrapperRef.current) {
        const table = tableWrapperRef.current.querySelector('table');
        if (table) {
          setTableWidth(table.scrollWidth);
        }
      }
    };

    updateWidth();

    // Update on window resize
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [children]);

  return (
    <>
      {/* Top horizontal scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          marginBottom: '4px',
          borderRadius: '8px'
        }}
      >
        <div style={{ width: tableWidth, height: '1px' }} />
      </div>

      {/* Table wrapper with both horizontal and vertical scrolling */}
      <div
        className={`table-wrapper scrollable-table-container ${className}`}
        ref={tableWrapperRef}
        onScroll={handleTableScroll}
        style={{
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto'
        }}
      >
        {children}
      </div>
    </>
  );
}