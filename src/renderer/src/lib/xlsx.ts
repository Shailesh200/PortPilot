import { readSheet } from 'read-excel-file/browser'
import writeXlsxFile from 'write-excel-file/browser'
import type { Cell } from 'write-excel-file/browser'

function cellValue(v: unknown): Cell {
  if (v == null) return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'string') return v
  return String(v)
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof Uint8Array) {
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer
  }
  return data
}

export async function workbookFromRows(
  rows: Record<string, unknown>[]
): Promise<Uint8Array> {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const header: Cell[] = keys.map((k) => ({
    value: k,
    fontWeight: 'bold'
  }))
  const body: Cell[][] = rows.map((row) => keys.map((k) => cellValue(row[k])))
  const file = writeXlsxFile([header, ...body])
  const blob = await file.toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

export async function rowsFromWorkbook(
  data: ArrayBuffer | Uint8Array
): Promise<Record<string, unknown>[]> {
  const table = await readSheet(toArrayBuffer(data))
  if (!table.length) throw new Error('Spreadsheet is empty')
  const headers = table[0].map((h, i) =>
    h == null || String(h).trim() === '' ? `col${i + 1}` : String(h).trim()
  )
  return table.slice(1).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      const v = row[i]
      obj[h] = v instanceof Date ? v.toISOString() : (v ?? '')
    })
    return obj
  })
}
