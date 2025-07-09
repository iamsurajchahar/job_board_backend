import { Hono } from 'hono'
import { prisma } from '../prismaClient'
import { requireAuth, requireUser } from '../auth'

const router = new Hono()

// 1) Apply to a job (User only)
router.post('/', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const { jobId, resume, coverLetter } = await c.req.json()

    // Validate input
    if (!jobId) {
      return c.json({ error: 'Job ID is required' }, 400)
    }

    // Check if job exists and is active
    const job = await prisma.job.findFirst({
      where: { id: jobId, isRemoved: false }
    })

    if (!job) {
      return c.json({ error: 'Job not found or no longer available' }, 404)
    }

    // Check if user already applied
    const existingApplication = await prisma.jobApplication.findFirst({
      where: { jobId, applicantId: userId }
    })

    if (existingApplication) {
      return c.json({ error: 'You have already applied to this job' }, 400)
    }

    // Check subscription limits
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true }
    })

    if (!subscription || subscription.status !== 'ACTIVE') {
      return c.json({ error: 'Active subscription required' }, 403)
    }

    // Check application limit
    const applicationsCount = await prisma.jobApplication.count({
      where: { applicantId: userId }
    })

    if (subscription.plan.userApplicationsLimit !== 999999 && applicationsCount >= subscription.plan.userApplicationsLimit) {
      return c.json({ error: 'Application limit reached. Upgrade to premium for unlimited applications.' }, 403)
    }

    // Create application
    const application = await prisma.jobApplication.create({
      data: {
        jobId,
        applicantId: userId,
        resume,
        coverLetter
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Update subscription counter
    await prisma.userSubscription.update({
      where: { userId },
      data: { applicationsUsed: { increment: 1 } }
    })

    return c.json({
      message: 'Application submitted successfully',
      application
    })
  } catch (error) {
    console.error('Application creation error:', error)
    return c.json({ error: 'Failed to submit application' }, 500)
  }
})

// 2) Get user's applications (User only)
router.get('/my-applications', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const { page = '1', limit = '10', status } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: any = { applicantId: userId }
    if (status) where.status = status

    const [applications, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              salary: true,
              type: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true
                }
              }
            }
          }
        },
        orderBy: { appliedAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.jobApplication.count({ where })
    ])

    return c.json({
      applications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Applications fetch error:', error)
    return c.json({ error: 'Failed to fetch applications' }, 500)
  }
})

// 3) Get application by ID (User only - own applications)
router.get('/:id', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const applicationId = parseInt(c.req.param('id'))

    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, applicantId: userId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            salary: true,
            type: true,
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                website: true,
                about: true
              }
            }
          }
        }
      }
    })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    return c.json({ application })
  } catch (error) {
    console.error('Application fetch error:', error)
    return c.json({ error: 'Failed to fetch application' }, 500)
  }
})

// 4) Update application status (Company only - for their jobs)
router.patch('/:id/status', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    const applicationId = parseInt(c.req.param('id'))
    const { status } = await c.req.json()

    // Only companies can update application status
    if (entityType !== 'Company') {
      return c.json({ error: 'Only companies can update application status' }, 403)
    }

    // Validate status
    const validStatuses = ['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    // Check if application exists and belongs to company's job
    const application = await prisma.jobApplication.findFirst({
      where: { 
        id: applicationId,
        job: { companyId: userId }
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        applicant: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!application) {
      return c.json({ error: 'Application not found or access denied' }, 404)
    }

    // Update status
    const updatedApplication = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        applicant: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return c.json({
      message: 'Application status updated successfully',
      application: updatedApplication
    })
  } catch (error) {
    console.error('Application status update error:', error)
    return c.json({ error: 'Failed to update application status' }, 500)
  }
})

// 5) Withdraw application (User only - own applications)
router.delete('/:id', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const applicationId = parseInt(c.req.param('id'))

    // Check if application exists and belongs to user
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, applicantId: userId }
    })

    if (!application) {
      return c.json({ error: 'Application not found or access denied' }, 404)
    }

    // Check if application can be withdrawn
    if (application.status === 'ACCEPTED' || application.status === 'REJECTED') {
      return c.json({ error: 'Cannot withdraw application that has been accepted or rejected' }, 400)
    }

    // Update status to withdrawn
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN' }
    })

    return c.json({ message: 'Application withdrawn successfully' })
  } catch (error) {
    console.error('Application withdrawal error:', error)
    return c.json({ error: 'Failed to withdraw application' }, 500)
  }
})

// 6) Get applications for a job (Company only - for their jobs)
router.get('/job/:jobId', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    const jobId = parseInt(c.req.param('jobId'))
    const { page = '1', limit = '10', status } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Only companies can view applications for their jobs
    if (entityType !== 'Company') {
      return c.json({ error: 'Only companies can view job applications' }, 403)
    }

    // Check if job belongs to company
    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: userId, isRemoved: false }
    })

    if (!job) {
      return c.json({ error: 'Job not found or access denied' }, 404)
    }

    // Build where clause
    const where: any = { jobId }
    if (status) where.status = status

    const [applications, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
              skills: true,
              bio: true,
              location: true
            }
          }
        },
        orderBy: { appliedAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.jobApplication.count({ where })
    ])

    return c.json({
      applications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Job applications fetch error:', error)
    return c.json({ error: 'Failed to fetch job applications' }, 500)
  }
})

export default router
