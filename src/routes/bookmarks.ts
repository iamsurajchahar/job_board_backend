import { Hono } from 'hono'
import { prisma } from '../prismaClient'
import { requireUser } from '../auth'

const router = new Hono()

// 1) Add job to bookmarks (User only)
router.post('/', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const { jobId } = await c.req.json()

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

    // Check if already bookmarked
    const existingBookmark = await prisma.bookmark.findFirst({
      where: { userId, jobId }
    })

    if (existingBookmark) {
      return c.json({ error: 'Job is already bookmarked' }, 400)
    }

    // Create bookmark
    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        jobId
      },
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
      }
    })

    return c.json({
      message: 'Job bookmarked successfully',
      bookmark
    })
  } catch (error) {
    console.error('Bookmark creation error:', error)
    return c.json({ error: 'Failed to bookmark job' }, 500)
  }
})

// 2) Get user's bookmarks (User only)
router.get('/', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const { page = '1', limit = '10' } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId },
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
                  industry: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.bookmark.count({ where: { userId } })
    ])

    return c.json({
      bookmarks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Bookmarks fetch error:', error)
    return c.json({ error: 'Failed to fetch bookmarks' }, 500)
  }
})

// 3) Remove bookmark (User only)
router.delete('/:jobId', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const jobId = parseInt(c.req.param('jobId'))

    // Check if bookmark exists
    const bookmark = await prisma.bookmark.findFirst({
      where: { userId, jobId }
    })

    if (!bookmark) {
      return c.json({ error: 'Bookmark not found' }, 404)
    }

    // Delete bookmark
    await prisma.bookmark.delete({
      where: { id: bookmark.id }
    })

    return c.json({ message: 'Bookmark removed successfully' })
  } catch (error) {
    console.error('Bookmark removal error:', error)
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

// 4) Check if job is bookmarked (User only)
router.get('/check/:jobId', requireUser(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const jobId = parseInt(c.req.param('jobId'))

    const bookmark = await prisma.bookmark.findFirst({
      where: { userId, jobId }
    })

    return c.json({
      isBookmarked: !!bookmark,
      bookmark: bookmark ? { id: bookmark.id, createdAt: bookmark.createdAt } : null
    })
  } catch (error) {
    console.error('Bookmark check error:', error)
    return c.json({ error: 'Failed to check bookmark status' }, 500)
  }
})

export default router 