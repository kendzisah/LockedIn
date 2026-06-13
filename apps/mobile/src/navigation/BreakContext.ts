import React from 'react';

/**
 * Opens the shared "Take a Break" picker sheet. Mounted once in MainNavigator
 * (alongside the Lock In duration picker) and triggered from both the
 * full-screen timer page and the minimized Home focus card.
 */
export const BreakContext = React.createContext<{ openBreakPicker: () => void }>({
  openBreakPicker: () => {},
});
