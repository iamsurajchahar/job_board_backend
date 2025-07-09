import { serve } from '@hono/node-server'
import 'dotenv/config'
import app from './index'

const port = Number(process.env.PORT) || 4000

console.log(`🚀 Job Board API starting on port ${port}...`)

serve({ fetch: app.fetch, port })

console.log(`✅ Server running at http://localhost:${port}`)
console.log(`📚 API Documentation available at http://localhost:${port}`) 