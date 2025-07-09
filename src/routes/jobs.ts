import { Hono } from 'hono'
import { prisma } from '../prismaClient'
import { requireAuth, requireCompany } from '../auth'

const router = new Hono()

// 1) Get all jobs (public)
router.get('/', async (c) => {
  try {
    const { page = '1', limit = '10', type, location, company } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: any = { isRemoved: false }
    if (type) where.type = type
    if (location) where.location = { contains: location, mode: 'insensitive' }
    if (company) {
      where.company = { name: { contains: company, mode: 'insensitive' } }
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.job.count({ where })
    ])

    return c.json({
      jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Jobs fetch error:', error)
    return c.json({ error: 'Failed to fetch jobs' }, 500)
  }
})

// 2) Get job by ID (public)
router.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const job = await prisma.job.findFirst({
      where: { id, isRemoved: false },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            industry: true,
            website: true,
            about: true
          }
        }
      }
    })

    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }

    return c.json({ job })
  } catch (error) {
    console.error('Job fetch error:', error)
    return c.json({ error: 'Failed to fetch job' }, 500)
  }
})

// 3) Create job (Company only)
router.post('/', requireCompany(), async (c) => {
  try {
    const companyId = (c as any).get('userId') as number
    const { title, description, location, salary, type } = await c.req.json()

    // Validate input
    if (!title || !description || !location || !type) {
      return c.json({ error: 'Title, description, location, and type are required' }, 400)
    }

    // Check subscription limits
    const subscription = await prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true }
    })

    if (!subscription || subscription.status !== 'ACTIVE') {
      return c.json({ error: 'Active subscription required' }, 403)
    }

    // Check job limits based on type
    if (type === 'FULL_TIME') {
      if (subscription.plan.companyJobsLimit !== 999999 && subscription.jobsPosted >= subscription.plan.companyJobsLimit) {
        return c.json({ error: 'Job posting limit reached. Upgrade to premium for unlimited jobs.' }, 403)
      }
    } else if (type === 'INTERNSHIP') {
      if (subscription.plan.companyInternshipsLimit !== 999999 && subscription.internshipsPosted >= subscription.plan.companyInternshipsLimit) {
        return c.json({ error: 'Internship posting limit reached. Upgrade to premium for unlimited internships.' }, 403)
      }
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        title,
        description,
        location,
        salary,
        type,
        companyId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      }
    })

    // Update subscription counters
    if (type === 'FULL_TIME') {
      await prisma.companySubscription.update({
        where: { companyId },
        data: { jobsPosted: { increment: 1 } }
      })
    } else if (type === 'INTERNSHIP') {
      await prisma.companySubscription.update({
        where: { companyId },
        data: { internshipsPosted: { increment: 1 } }
      })
    }

    return c.json({
      message: 'Job created successfully',
      job
    })
  } catch (error) {
    console.error('Job creation error:', error)
    return c.json({ error: 'Failed to create job' }, 500)
  }
})

// 4) Update job (Company owner only)
router.put('/:id', requireCompany(), async (c) => {
  try {
    const companyId = (c as any).get('userId') as number
    const jobId = parseInt(c.req.param('id'))
    const { title, description, location, salary, type } = await c.req.json()

    // Check if job exists and belongs to company
    const existingJob = await prisma.job.findFirst({
      where: { id: jobId, companyId, isRemoved: false }
    })

    if (!existingJob) {
      return c.json({ error: 'Job not found or access denied' }, 404)
    }

    // Update job
    const job = await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        description,
        location,
        salary,
        type
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      }
    })

    return c.json({
      message: 'Job updated successfully',
      job
    })
  } catch (error) {
    console.error('Job update error:', error)
    return c.json({ error: 'Failed to update job' }, 500)
  }
})

// 5) Delete job (Company owner only)
router.delete('/:id', requireCompany(), async (c) => {
  try {
    const companyId = (c as any).get('userId') as number
    const jobId = parseInt(c.req.param('id'))

    // Check if job exists and belongs to company
    const existingJob = await prisma.job.findFirst({
      where: { id: jobId, companyId, isRemoved: false }
    })

    if (!existingJob) {
      return c.json({ error: 'Job not found or access denied' }, 404)
    }

    // Soft delete job
    await prisma.job.update({
      where: { id: jobId },
      data: { isRemoved: true }
    })

    return c.json({ message: 'Job deleted successfully' })
  } catch (error) {
    console.error('Job deletion error:', error)
    return c.json({ error: 'Failed to delete job' }, 500)
  }
})

// 6) Get company's jobs (Company only)
router.get('/company/my-jobs', requireCompany(), async (c) => {
  try {
    const companyId = (c as any).get('userId') as number
    const { page = '1', limit = '10' } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { companyId, isRemoved: false },
        include: {
          applications: {
            select: {
              id: true,
              status: true,
              appliedAt: true,
              applicant: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.job.count({ where: { companyId, isRemoved: false } })
    ])

    return c.json({
      jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Company jobs fetch error:', error)
    return c.json({ error: 'Failed to fetch company jobs' }, 500)
  }
})

export default router
