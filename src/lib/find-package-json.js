import { existsSync } from 'fs'
import path from 'path'

export function findPackageJson (dir) {
  dir = dir || path.resolve(process.cwd(), process.env.PLEASURE_ROOT || './')
  const local = path.join(dir, 'package.json')
  if (!existsSync(local)) {
    // todo: fix for different platforms
    if (local === '/') {
      return
    }

    return findPackageJson(path.join(dir, '../'))
  }

  return local
}
