import { Hono } from 'hono'
import { prisma } from '../prismaClient'
import { requireAuth } from '../auth'

const router = new Hono()

// 1) Get available plans (public)
router.get('/plans', async (c) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' }
    })

    return c.json({ plans })
  } catch (error) {
    console.error('Plans fetch error:', error)
    return c.json({ error: 'Failed to fetch plans' }, 500)
  }
})

// 2) Get current subscription (User/Company only)
router.get('/current', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string

    let subscription = null

    if (entityType === 'User') {
      subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    } else if (entityType === 'Company') {
      subscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    }

    return c.json({ subscription })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return c.json({ error: 'Failed to fetch subscription' }, 500)
  }
})

// 3) Create subscription (User/Company only)
router.post('/', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    const { planId } = await c.req.json()

    // Validate input
    if (!planId) {
      return c.json({ error: 'Plan ID is required' }, 400)
    }

    // Check if plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404)
    }

    // Check if already has active subscription
    if (entityType === 'User') {
      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId }
      })

      if (existingSubscription && existingSubscription.status === 'ACTIVE') {
        return c.json({ error: 'User already has an active subscription' }, 400)
      }
    } else if (entityType === 'Company') {
      const existingSubscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId }
      })

      if (existingSubscription && existingSubscription.status === 'ACTIVE') {
        return c.json({ error: 'Company already has an active subscription' }, 400)
      }
    }

    // Create or update subscription
    let subscription = null
    if (entityType === 'User') {
      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId }
      })

      if (existingSubscription) {
        // Update existing subscription
        subscription = await prisma.userSubscription.update({
          where: { userId },
          data: {
            planId,
            status: plan.price === 0 ? 'ACTIVE' : 'PENDING',
            endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
            applicationsUsed: 0 // Reset usage for new plan
          },
          include: {
            plan: true
          }
        })
      } else {
        // Create new subscription
        subscription = await prisma.userSubscription.create({
          data: {
            userId,
            planId,
            status: plan.price === 0 ? 'ACTIVE' : 'PENDING',
            endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
          },
          include: {
            plan: true
          }
        })
      }
    } else if (entityType === 'Company') {
      const existingSubscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId }
      })

      if (existingSubscription) {
        // Update existing subscription
        subscription = await prisma.companySubscription.update({
          where: { companyId: userId },
          data: {
            planId,
            status: plan.price === 0 ? 'ACTIVE' : 'PENDING',
            endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
            jobsPosted: 0, // Reset usage for new plan
            internshipsPosted: 0
          },
          include: {
            plan: true
          }
        })
      } else {
        // Create new subscription
        subscription = await prisma.companySubscription.create({
          data: {
            companyId: userId,
            planId,
            status: plan.price === 0 ? 'ACTIVE' : 'PENDING',
            endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000)
          },
          include: {
            plan: true
          }
        })
      }
    }

    return c.json({
      message: 'Subscription created successfully',
      subscription
    })
  } catch (error) {
    console.error('Subscription creation error:', error)
    return c.json({ error: 'Failed to create subscription' }, 500)
  }
})

// 4) Cancel subscription (User/Company only)
router.delete('/', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string

    if (entityType === 'User') {
      await prisma.userSubscription.update({
        where: { userId },
        data: { status: 'CANCELLED' }
      })
    } else if (entityType === 'Company') {
      await prisma.companySubscription.update({
        where: { companyId: userId },
        data: { status: 'CANCELLED' }
      })
    }

    return c.json({ message: 'Subscription cancelled successfully' })
  } catch (error) {
    console.error('Subscription cancellation error:', error)
    return c.json({ error: 'Failed to cancel subscription' }, 500)
  }
})

// 5) Get subscription usage (User/Company only)
router.get('/usage', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string

    let usage = null

    if (entityType === 'User') {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        include: { plan: true }
      })

      if (subscription) {
        usage = {
          applicationsUsed: subscription.applicationsUsed,
          applicationsLimit: subscription.plan.userApplicationsLimit,
          remainingApplications: subscription.plan.userApplicationsLimit - subscription.applicationsUsed
        }
      }
    } else if (entityType === 'Company') {
      const subscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId },
        include: { plan: true }
      })

      if (subscription) {
        usage = {
          jobsPosted: subscription.jobsPosted,
          jobsLimit: subscription.plan.companyJobsLimit,
          remainingJobs: subscription.plan.companyJobsLimit - subscription.jobsPosted,
          internshipsPosted: subscription.internshipsPosted,
          internshipsLimit: subscription.plan.companyInternshipsLimit,
          remainingInternships: subscription.plan.companyInternshipsLimit - subscription.internshipsPosted
        }
      }
    }

    return c.json({ usage })
  } catch (error) {
    console.error('Usage fetch error:', error)
    return c.json({ error: 'Failed to fetch usage' }, 500)
  }
})

export default router 