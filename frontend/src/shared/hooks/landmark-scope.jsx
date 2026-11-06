import React, { useContext } from 'react';
// The same components can be open in two independent case panels. Give their
// landmarks a case-specific accessible name without changing the normal drawer.
export const LandmarkScope = React.createContext('');
export function useLandmarkScope() {
  const scope = useContext(LandmarkScope);
  return label => (scope ? `${label} · ${scope}` : label);
}
