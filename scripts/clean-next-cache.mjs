import { rm } from "node:fs/promises"

const targets = [".next", "tsconfig.tsbuildinfo"]

for (const target of targets) {
  await rm(target, { force: true, recursive: true })
}
