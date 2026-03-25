'use client';

import { useRef, useState } from 'react';

export function usePolylineTooltip() {
  const [polylineTooltip, setPolylineTooltip] = useState<string | null>(null);
  const polylineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showPolylineTooltip(text: string) {
    setPolylineTooltip(text);
    if (polylineTimerRef.current) {
      clearTimeout(polylineTimerRef.current);
    }
    polylineTimerRef.current = setTimeout(() => setPolylineTooltip(null), 3000);
  }

  return {
    polylineTooltip,
    showPolylineTooltip,
  };
}
