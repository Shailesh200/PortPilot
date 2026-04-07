import log from 'electron-log/main'

log.initialize()
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

export default log
