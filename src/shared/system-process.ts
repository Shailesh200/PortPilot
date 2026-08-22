/**
 * Heuristic for OS / vendor daemons that clutter the Ports dashboard.
 * Distinct from `isCritical` (well-known ports protected from kill).
 * Local databases and language runtimes are never treated as system.
 */

const KEEP_DEV =
  /^(node|node-exp|python[\d.]*|ruby|java|php[\d.]*|perl|nginx|caddy|httpd|apache2?|postgres|mysqld?|mariadbd|redis-ser|mongod|docker|com\.docke|OrbStack|lima|colima|vite|next-serv|deno|bun|uv|cargo|webpack|esbuild|turbo|pnpm|npm|yarn|gradle|kotlin|elixir|beam\.smp|puma|unicorn|gunicorn|uvicorn|hypercorn|daphne|dotnet|sqlservr|code|Cursor|Electron)$/i

const SYSTEM_CMD =
  /^(ControlCe|rapportd|sharingd|identityservices|UserEventAgent|WiFiAgent|logioptio|LogiMgr|AirPlayXPC|bluetoothd|coreaudiod|WindowManager|WindowServer|mDNSRespon|launchd|syslogd|configd|notifyd|securityd|loginwindow|cfprefsd|distnoted|filecoord|fseventsd|kernel_task|Spotlight|mds$|mds_stores|corespotli|AppleSpell|universalA|CommCenter|locationd|cloudd|bird$|akd$|nsurlsess|trustd|secd$|accountsd|CalendarA|ContactsA|photolibr|AMPDevice|usbmuxd|cupsd|ntpd|chronyd|systemd|NetworkMa|avahi-dae|cups-brow|rpcbind|sshd$|finder$|Dock$|SystemUISe|coreauthd|authd|diskarbitr|powerd|syspolicyd|tccd|svchost|services|lsass|wininit|spoolsv|SearchApp|SearchHost|ShellExperience|RuntimeBroker|dwm|csrss|smss|winlogon|MsMpEng|SecurityHealth)$/i

function isUserProjectPath(path: string): boolean {
  return /\/Users\/|\/home\/|\\Users\\|\/Documents\/|\/projects\/|\/dev\/|\/src\/|\\src\\/i.test(
    path
  )
}

export function isSystemProcess(p: {
  command: string
  user: string
  projectPath?: string
}): boolean {
  const cmd = (p.command || '').replace(/\.exe$/i, '')
  if (KEEP_DEV.test(cmd)) return false
  const path = p.projectPath || ''
  if (path && path !== '/' && path !== '\\' && isUserProjectPath(path)) {
    return false
  }
  if (SYSTEM_CMD.test(cmd)) return true
  if (p.user.startsWith('_')) return true
  if (/^NT AUTHORITY/i.test(p.user)) return true
  return false
}
