import { useEffect, useRef } from 'react';
import { installCoordinateTouchRouter } from './protectedGameTouch';

// React adapter for the same native coordinate router used by the canvas games.
export default function useCoordinateTouchControls(rootRef, { onPress, onRelease, directionalCodes = [] }) {
  const callbacksRef = useRef({ onPress, onRelease, directionalCodes });
  callbacksRef.current = { onPress, onRelease, directionalCodes };

  useEffect(() => installCoordinateTouchRouter(rootRef.current, {
    continuousCodes: callbacksRef.current.directionalCodes,
    onPress: (code) => callbacksRef.current.onPress?.(code),
    onRelease: (code) => callbacksRef.current.onRelease?.(code),
  }), [rootRef]);
}
