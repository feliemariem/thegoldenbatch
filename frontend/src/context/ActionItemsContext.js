import React, { createContext, useContext, useState, useCallback } from 'react';

const ActionItemsContext = createContext();

export function ActionItemsProvider({ children }) {
  // This version number increments whenever an action item is updated
  // Components can subscribe to this and refetch when it changes
  const [updateVersion, setUpdateVersion] = useState(0);

  // Track which action item was last updated for more targeted refreshes
  const [lastUpdatedItem, setLastUpdatedItem] = useState(null);

  // Call this when an action item status is updated
  const notifyActionItemUpdate = useCallback((actionItemId, newStatus) => {
    setLastUpdatedItem({ id: actionItemId, status: newStatus, timestamp: Date.now() });
    setUpdateVersion(v => v + 1);
  }, []);

  return (
    <ActionItemsContext.Provider value={{
      updateVersion,
      lastUpdatedItem,
      notifyActionItemUpdate
    }}>
      {children}
    </ActionItemsContext.Provider>
  );
}

export function useActionItems() {
  const context = useContext(ActionItemsContext);
  if (!context) {
    throw new Error('useActionItems must be used within an ActionItemsProvider');
  }
  return context;
}
