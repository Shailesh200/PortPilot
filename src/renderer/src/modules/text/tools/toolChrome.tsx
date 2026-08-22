import {
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type TextareaHTMLAttributes
} from 'react'
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '../../../stores/uiStore'
import { ToolBadge, ToolButton } from './toolUi'

export const TOOL_MONO_TEXTAREA_CLASS =
  'flex-1 w-full min-h-0 resize-none bg-transparent px-4 py-3 text-[13px] leading-6 font-mono text-text-primary placeholder:text-text-muted focus:outline-none'

export function ToolMonoTextarea({
  className,
  spellCheck = false,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      spellCheck={spellCheck}
      {...props}
      className={clsx(TOOL_MONO_TEXTAREA_CLASS, className)}
    />
  )
}

export async function readClipboardText(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText()
    return text || null
  } catch {
    return null
  }
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function ToolPasteCopy({
  onPaste,
  copyText,
  copyDisabled,
  copyLabel = 'Copy',
  pasteOnly,
  toastOnBlock,
  toastOnCopy
}: {
  onPaste: (text: string) => void
  copyText?: string
  copyDisabled?: boolean
  copyLabel?: string
  pasteOnly?: boolean
  toastOnBlock?: boolean
  toastOnCopy?: string
}) {
  const addToast = useUIStore((s) => s.addToast)

  const paste = async () => {
    const text = await readClipboardText()
    if (text) {
      onPaste(text)
      return
    }
    if (toastOnBlock) {
      addToast({
        type: 'warning',
        title: 'Clipboard blocked',
        message: 'Allow paste permission and try again'
      })
    }
  }

  const copy = async () => {
    if (!copyText) return
    const ok = await writeClipboardText(copyText)
    if (ok && toastOnCopy) {
      addToast({ type: 'success', title: 'Copied', message: toastOnCopy })
    } else if (!ok && toastOnBlock) {
      addToast({ type: 'error', title: 'Copy failed' })
    }
  }

  return (
    <span className="ml-auto flex items-center gap-1.5">
      <ToolButton variant="ghost" onClick={() => void paste()}>
        <ClipboardPaste className="w-3.5 h-3.5" />
        Paste
      </ToolButton>
      {pasteOnly ? null : (
        <ToolButton
          variant="primary"
          disabled={copyDisabled ?? !copyText}
          onClick={() => void copy()}
        >
          <Copy className="w-3.5 h-3.5" />
          {copyLabel}
        </ToolButton>
      )}
    </span>
  )
}

export function ToolFindBar({
  value,
  onChange,
  disabled,
  label,
  onPrev,
  onNext,
  matchCount,
  inputRef,
  widthClass = 'w-52'
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  label?: string
  onPrev: () => void
  onNext: () => void
  matchCount: number
  inputRef?: Ref<HTMLInputElement>
  widthClass?: string
}) {
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.key === 'Enter' && e.shiftKey) onPrev()
      else onNext()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onPrev()
    }
  }

  return (
    <>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find…"
          disabled={disabled}
          className={clsx(
            'bg-bg-elevated border border-border-strong rounded-full pl-8 pr-14 py-1.5 text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-40',
            widthClass
          )}
        />
        {label ? (
          <span className="absolute right-2 text-[10px] text-text-muted tabular-nums pointer-events-none">
            {label}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        title="Previous (Shift+Enter)"
        disabled={matchCount === 0}
        onClick={onPrev}
        className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Next (Enter)"
        disabled={matchCount === 0}
        onClick={onNext}
        className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </>
  )
}

export function DiffNavControls({
  label,
  onPrev,
  onNext,
  prevTitle = 'Previous change',
  nextTitle = 'Next change'
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  prevTitle?: string
  nextTitle?: string
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <ToolBadge tone="warn">{label} changed</ToolBadge>
      <button
        type="button"
        title={prevTitle}
        onClick={onPrev}
        className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title={nextTitle}
        onClick={onNext}
        className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}
