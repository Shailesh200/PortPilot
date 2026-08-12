import {
  getDocument as pdfGetDocument,
  GlobalWorkerOptions
} from 'pdfjs-dist/legacy/build/pdf.mjs'

let workerReady = false

/** Configure the PDF.js worker once — call only from PDF code paths. */
export function ensurePdfjsWorker(): void {
  if (workerReady) return
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  workerReady = true
}

export function getDocument(
  ...args: Parameters<typeof pdfGetDocument>
): ReturnType<typeof pdfGetDocument> {
  ensurePdfjsWorker()
  return pdfGetDocument(...args)
}
