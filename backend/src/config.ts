import dotenv from 'dotenv'

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env', quiet: true })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  accessSecret: required('JWT_ACCESS_SECRET'),
  refreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',
}
