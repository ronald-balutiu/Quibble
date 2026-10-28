import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetRoot = new URL('../dist/client/', import.meta.url)
const maxBytes = 25 * 1024 * 1024

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await checkDirectory(path)
    } else if ((await stat(path)).size > maxBytes) {
      throw new Error(`Static asset exceeds the 25 MiB limit: ${path}`)
    }
  }
}

await checkDirectory(fileURLToPath(assetRoot))
console.log('All static assets are within the 25 MiB per-file limit.')
