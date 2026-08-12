import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type RefCallback
} from 'react'
import { createPortal } from 'react-dom'

const ToolbarSlotContext = createContext<HTMLElement | null>(null)

/** Provides a DOM slot so tools can portal their action row into the frame header. */
export function WorkspaceToolbarSlotProvider({
  children
}: {
  children: (slotRef: RefCallback<HTMLDivElement>) => ReactNode
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const slotRef: RefCallback<HTMLDivElement> = (el) => {
    setSlot((prev) => (prev === el ? prev : el))
  }
  return (
    <ToolbarSlotContext.Provider value={slot}>
      {children(slotRef)}
    </ToolbarSlotContext.Provider>
  )
}

/** Renders children into the workspace header action slot (falls back inline). */
export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  const slot = useContext(ToolbarSlotContext)
  if (!slot) {
    return <div className="flex-shrink-0 mb-2">{children}</div>
  }
  return createPortal(children, slot)
}
