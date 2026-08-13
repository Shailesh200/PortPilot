import appIcon from '../assets/app-icon.png'

export function TitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-[52px] bg-bg-surface/80 backdrop-blur-xl border-b border-border-subtle flex items-center z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5 pl-[80px]">
        <img
          src={appIcon}
          alt=""
          className="w-5 h-5 rounded-[5px] shadow-sm"
        />
        <span className="text-sm font-semibold text-text-primary tracking-tight">
          PortPilot
        </span>
      </div>
      <div className="flex-1" />
      <div
        className="pr-4 flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
          <span className="kbd">⌘</span>
          <span className="text-text-muted">+</span>
          <span className="kbd">K</span>
          <span className="ml-1.5 text-text-muted">Command Palette</span>
        </span>
      </div>
    </div>
  )
}
