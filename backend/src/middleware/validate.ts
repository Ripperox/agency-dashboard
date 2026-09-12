import { Request, Response, NextFunction } from 'express'
import { ZodType } from 'zod'

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) return next(result.error)
    req.body = result.data
    next()
  }
}

// express 5 makes req.query a getter so we can't overwrite it, stash the parsed version instead
export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) return next(result.error)
    ;(req as any).validatedQuery = result.data
    next()
  }
}

export function getQuery<T>(req: Request): T {
  return (req as any).validatedQuery as T
}
