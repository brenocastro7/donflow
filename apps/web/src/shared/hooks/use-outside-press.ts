import { useEffect, useRef } from 'react';

export function useOutsidePress<T extends HTMLElement>(
  active: boolean,
  onOutsidePress: () => void,
) {
  const containerRef = useRef<T>(null);
  const callbackRef = useRef(onOutsidePress);
  callbackRef.current = onOutsidePress;

  useEffect(() => {
    if (!active) return;

    const handleOutsidePress = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        callbackRef.current();
      }
    };

    document.addEventListener('pointerdown', handleOutsidePress);
    return () => document.removeEventListener('pointerdown', handleOutsidePress);
  }, [active]);

  return containerRef;
}
