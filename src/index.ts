import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'

// Import routes
import authRoutes from './routes/auth'
import jobsRoutes from './routes/jobs'
import applicationsRoutes from './routes/applications'
import bookmarksRoutes from './routes/bookmarks'
import subscriptionsRoutes from './routes/subscriptions'

import paymentsRoutes from './routes/payments'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://your-frontend-domain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'Job Board API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      jobs: '/api/jobs',
      applications: '/api/applications',
      bookmarks: '/api/bookmarks',
      subscriptions: '/api/subscriptions',

    }
  })
})

// API routes
app.route('/api/auth', authRoutes)
app.route('/api/jobs', jobsRoutes)
app.route('/api/applications', applicationsRoutes)
app.route('/api/bookmarks', bookmarksRoutes)
app.route('/api/subscriptions', subscriptionsRoutes)
app.route('/api/payments', paymentsRoutes)


// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /',
      'POST /api/auth/register/user',
      'POST /api/auth/register/company',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/jobs',
      'POST /api/jobs',
      'GET /api/jobs/:id',
      'PUT /api/jobs/:id',
      'DELETE /api/jobs/:id',
      'GET /api/jobs/company/my-jobs',
      'POST /api/applications',
      'GET /api/applications/my-applications',
      'GET /api/applications/:id',
      'PATCH /api/applications/:id/status',
      'DELETE /api/applications/:id',
      'GET /api/applications/job/:jobId',
      'POST /api/bookmarks',
      'GET /api/bookmarks',
      'DELETE /api/bookmarks/:jobId',
      'GET /api/bookmarks/check/:jobId',
      'GET /api/subscriptions/plans',
      'GET /api/subscriptions/current',
      'POST /api/subscriptions',
      'DELETE /api/subscriptions',
      'GET /api/subscriptions/usage',
      'POST /api/payments/create-order',
      'POST /api/payments/verify',
      'GET /api/payments/history',

    ]
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err)
  
  // Handle Prisma errors
  if (err.message.includes('prisma') || err.message.includes('database')) {
    return c.json({
      error: 'Database Error',
      message: 'An error occurred while accessing the database',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, 500)
  }

  // Handle JWT errors
  if (err.message.includes('jwt') || err.message.includes('token')) {
    return c.json({
      error: 'Authentication Error',
      message: 'Invalid or expired token'
    }, 401)
  }

  // Handle validation errors
  if (err.message.includes('validation') || err.message.includes('invalid')) {
    return c.json({
      error: 'Validation Error',
      message: err.message
    }, 400)
  }

  // Generic error
  return c.json({
    error: 'Internal Server Error',
    message: 'Something went wrong on our end',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500)
})

export default app
