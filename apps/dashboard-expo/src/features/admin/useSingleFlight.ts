import { useRef } from 'react';
import { createSingleFlight, type SingleFlight } from './single-flight';

/** A SingleFlight that lives as long as the component. */
export function useSingleFlight(): SingleFlight {
  const ref = useRef<SingleFlight | null>(null);
  ref.current ??= createSingleFlight();
  return ref.current;
}
