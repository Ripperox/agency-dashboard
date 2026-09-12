import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code || defaultCode(status)
  }
}

function defaultCode(status: number) {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    default:
      return 'INTERNAL_ERROR'
  }
}

export const notFound = (msg = 'Not found') => new AppError(404, msg)
export const forbidden = (msg = 'You do not have access to this resource') => new AppError(403, msg)
export const unauthorized = (msg = 'Not authenticated') => new AppError(401, msg)
export const badRequest = (msg: string) => new AppError(400, msg)

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
  }

  // body-parser throws this for malformed json
  if (typeof err === 'object' && err && (err as any).type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } })
  }

  console.error(err)
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}
