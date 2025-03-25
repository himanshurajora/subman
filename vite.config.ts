import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load package.json to get version
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, './package.json'), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Make the version available as a global variable
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },
})
