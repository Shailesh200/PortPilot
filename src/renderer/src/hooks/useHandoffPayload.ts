import { useEffect, useRef } from 'react'
import { useHandoffStore } from '../stores/handoffStore'

/** Consume a one-shot navigation payload (Cmd+K handoff) once on mount. */
export function useHandoffPayload(onPayload: (payload: string) => void): void {
  const take = useHandoffStore((s) => s.take)
  const cb = useRef(onPayload)
  cb.current = onPayload

  useEffect(() => {
    const { payload } = take()
    if (payload) cb.current(payload)
  }, [take])
}
