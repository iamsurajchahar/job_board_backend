import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'

// 1) Basic JWT check middleware
async function jwtMiddleware(c: Context, next: Next) {
  try {
    const auth = c.req.header('Authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    
    if (!token) {
      return c.json({ error: 'Missing token' }, 401)
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    
    // Validate payload
    if (!decoded.userId || !decoded.entityType) {
      return c.json({ error: 'Invalid token payload' }, 401)
    }
    
    c.set('userId', decoded.userId as number)
    c.set('entityType', decoded.entityType as string)
    await next()
  } catch (err) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

// 2) Require any authenticated user
export function requireAuth() {
  return jwtMiddleware
}

// 3) Require user (job seeker)
export function requireUser() {
  return async (c: Context, next: Next) => {
    await jwtMiddleware(c, next)
    const entityType = c.get('entityType') as string
    
    if (entityType !== 'User') {
      return c.json({ error: 'Only users can perform this action' }, 403)
    }

    // Check if user is banned
    const { prisma } = await import('./prismaClient')
    const userId = c.get('userId') as number
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true }
    })
    
    if (user?.isBanned) {
      return c.json({ error: 'Account is banned' }, 403)
    }
  }
}

// 4) Require company
export function requireCompany() {
  return async (c: Context, next: Next) => {
    await jwtMiddleware(c, next)
    const entityType = c.get('entityType') as string
    
    if (entityType !== 'Company') {
      return c.json({ error: 'Only companies can perform this action' }, 403)
    }

    // Check if company is banned
    const { prisma } = await import('./prismaClient')
    const companyId = c.get('userId') as number
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { isBanned: true }
    })
    
    if (company?.isBanned) {
      return c.json({ error: 'Account is banned' }, 403)
    }
  }
}


