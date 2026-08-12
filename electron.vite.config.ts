import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [tailwindcss(), react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('pdfjs-dist')) return 'pdfjs'
            if (
              id.includes('@codemirror') ||
              id.includes('@lezer') ||
              id.includes('@uiw/react-codemirror')
            ) {
              return 'codemirror'
            }
            if (
              id.includes('/docx/') ||
              id.includes('mammoth') ||
              id.includes('docx-preview')
            ) {
              return 'office'
            }
            if (
              id.includes('read-excel-file') ||
              id.includes('write-excel-file')
            ) {
              return 'excel'
            }
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('json-diff-kit') || id.includes('/diff/')) {
              return 'diff'
            }
          }
        }
      }
    }
  }
})
