import { useLayoutEffect, useState } from 'react';

// In-memory page state only. Never writes searches, IPs or record values to storage.
// The owner clears the ref on logout; blocked storage is irrelevant to this path.
export function useSessionValue(ref, scope, key, initial) {
  const [value, setValue] = useState(() => {
    const values = ref?.current?.[scope];
    return values && Object.hasOwn(values, key)
      ? values[key]
      : typeof initial === 'function'
        ? initial()
        : initial;
  });
  useLayoutEffect(() => {
    if (!ref) return;
    if (!ref.current[scope]) ref.current[scope] = {};
    ref.current[scope][key] = value;
  }, [ref, scope, key, value]);
  return [value, setValue];
}
