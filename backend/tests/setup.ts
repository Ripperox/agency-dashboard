import { execSync } from 'child_process'
import dotenv from 'dotenv'

// runs once before the test files. points prisma at the test db, applies migrations and seeds it.
export default async function () {
  process.env.NODE_ENV = 'test'
  dotenv.config({ path: '.env.test', override: true, quiet: true })
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
  const { seed } = await import('../prisma/seed')
  await seed()
}
