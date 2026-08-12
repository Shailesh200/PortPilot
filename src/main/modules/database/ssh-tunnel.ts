import { createServer, type Server, type Socket as NetSocket } from 'net'
import { homedir } from 'os'
import { join } from 'path'
import { Client, type ConnectConfig } from 'ssh2'
import { readFileSync, existsSync } from 'fs'

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(2) || '')
  }
  return p
}

export interface SshTunnelRequest {
  sshHost: string
  sshPort?: number
  sshUser: string
  sshPassword?: string
  privateKeyPath?: string
  /** Remote DB host as seen from the SSH server (e.g. postgres, 127.0.0.1). */
  targetHost: string
  targetPort: number
  /** Preferred local port; 0 = ephemeral. */
  localPort?: number
}

export interface SshTunnelHandle {
  localPort: number
  close: () => void
}

export async function openSshTunnel(
  req: SshTunnelRequest
): Promise<SshTunnelHandle> {
  const sshPort = req.sshPort || 22
  const config: ConnectConfig = {
    host: req.sshHost,
    port: sshPort,
    username: req.sshUser,
    readyTimeout: 20000
  }
  const keyPath = req.privateKeyPath
    ? expandHome(req.privateKeyPath.trim())
    : ''
  if (keyPath && existsSync(keyPath)) {
    config.privateKey = readFileSync(keyPath)
  } else if (req.sshPassword) {
    config.password = req.sshPassword
  } else {
    throw new Error(
      'SSH tunnel needs a password or private key path (e.g. ~/.ssh/id_ed25519)'
    )
  }

  const conn = new Client()
  await new Promise<void>((resolve, reject) => {
    conn
      .on('ready', () => resolve())
      .on('error', (err) => reject(err))
      .connect(config)
  })

  const server: Server = createServer((clientSocket: NetSocket) => {
    conn.forwardOut(
      '127.0.0.1',
      0,
      req.targetHost,
      req.targetPort,
      (err, stream) => {
        if (err) {
          clientSocket.destroy()
          return
        }
        clientSocket.pipe(stream)
        stream.pipe(clientSocket)
        clientSocket.on('error', () => stream.end())
        stream.on('error', () => clientSocket.destroy())
      }
    )
  })

  const localPort = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(req.localPort || 0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve(addr.port)
      else reject(new Error('Failed to bind local tunnel port'))
    })
  })

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    try {
      server.close()
    } catch {
      /* */
    }
    try {
      conn.end()
    } catch {
      /* */
    }
  }

  conn.on('close', () => {
    closed = true
    try {
      server.close()
    } catch {
      /* */
    }
  })

  return { localPort, close }
}
