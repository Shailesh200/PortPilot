/** Best-effort runtime / stack label from a process command. */
export function runtimeLabel(command: string): string | null {
  const c = (command || '').toLowerCase()
  if (/docker|com\.docke|orbstack|colima|containerd/.test(c)) return 'docker'
  if (/postgres|postmaster/.test(c)) return 'postgres'
  if (/mysqld|mariadb/.test(c)) return 'mysql'
  if (/redis-ser/.test(c)) return 'redis'
  if (/mongod/.test(c)) return 'mongo'
  if (/vite|next-serv|next\b/.test(c)) return 'next/vite'
  if (/node|deno|bun/.test(c)) return 'node'
  if (/python|uvicorn|gunicorn/.test(c)) return 'python'
  if (/ruby|puma|unicorn/.test(c)) return 'ruby'
  if (/java|gradle|kotlin/.test(c)) return 'jvm'
  if (/nginx|caddy|httpd|apache/.test(c)) return 'http'
  if (/code|cursor|electron/.test(c)) return 'editor'
  return null
}
