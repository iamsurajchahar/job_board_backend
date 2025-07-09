import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prismaClient'
import { requireAuth } from '../auth'

const router = new Hono()

// 1) User Registration
router.post('/register/user', async (c) => {
  try {
    const { email, password, name, skills, bio, location } = await c.req.json()

    // Validate input
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get free plan
    const freePlan = await prisma.plan.findFirst({
      where: { type: 'FREE' as any }
    })

    if (!freePlan) {
      return c.json({ error: 'Free plan not found' }, 500)
    }

    // Create user with transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          skills,
          bio,
          location
        }
      })

      // Assign user role
      const userRole = await tx.role.findFirst({
        where: { name: 'User' }
      })

      if (userRole) {
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: userRole.id
          }
        })
      }

      // Create subscription
      await tx.userSubscription.create({
        data: {
          userId: newUser.id,
          planId: freePlan.id
        }
      })

      return newUser
    })

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, entityType: 'User' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return c.json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        skills: user.skills,
        bio: user.bio,
        location: user.location
      }
    })
  } catch (error) {
    console.error('User registration error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// 2) Company Registration
router.post('/register/company', async (c) => {
  try {
    const { email, password, name, website, about, industry, logo } = await c.req.json()

    // Validate input
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400)
    }

    // Check if company already exists
    const existingCompany = await prisma.company.findUnique({
      where: { email }
    })

    if (existingCompany) {
      return c.json({ error: 'Company already exists' }, 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get free plan
    const freePlan = await prisma.plan.findFirst({
      where: { type: 'FREE' as any }
    })

    if (!freePlan) {
      return c.json({ error: 'Free plan not found' }, 500)
    }

    // Create company with transaction
    const company = await prisma.$transaction(async (tx) => {
      // Create company
      const newCompany = await tx.company.create({
        data: {
          email,
          password: hashedPassword,
          name,
          website,
          about,
          industry,
          logo
        }
      })

      // Assign company role
      const companyRole = await tx.role.findFirst({
        where: { name: 'Company' }
      })

      if (companyRole) {
        await tx.companyRole.create({
          data: {
            companyId: newCompany.id,
            roleId: companyRole.id
          }
        })
      }

      // Create subscription
      await tx.companySubscription.create({
        data: {
          companyId: newCompany.id,
          planId: freePlan.id
        }
      })

      return newCompany
    })

    // Generate JWT token
    const token = jwt.sign(
      { userId: company.id, entityType: 'Company' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return c.json({
      message: 'Company registered successfully',
      token,
      company: {
        id: company.id,
        email: company.email,
        name: company.name,
        website: company.website,
        about: company.about,
        industry: company.industry,
        logo: company.logo
      }
    })
  } catch (error) {
    console.error('Company registration error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})



// 4) Login
router.post('/login', async (c) => {
  try {
    const { email, password, entityType } = await c.req.json()

    // Validate input
    if (!email || !password || !entityType) {
      return c.json({ error: 'Email, password, and entityType are required' }, 400)
    }

    let entity: any = null
    let roles: any[] = []

    // Find entity based on type
    switch (entityType) {
      case 'User':
        entity = await prisma.user.findUnique({
          where: { email },
          include: {
            userRoles: { include: { role: true } }
          }
        })
        if (entity) {
          roles = entity.userRoles.map((ur: any) => ur.role.name)
        }
        break

      case 'Company':
        entity = await prisma.company.findUnique({
          where: { email },
          include: {
            companyRoles: { include: { role: true } }
          }
        })
        if (entity) {
          roles = entity.companyRoles.map((ur: any) => ur.role.name)
        }
        break



      default:
        return c.json({ error: 'Invalid entity type' }, 400)
    }

    if (!entity) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Check if banned
    if (entity.isBanned) {
      return c.json({ error: 'Account is banned' }, 403)
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, entity.password)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: entity.id, entityType },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const response: any = {
      message: 'Login successful',
      token,
      roles,
      [entityType.toLowerCase()]: {
        id: entity.id,
        email: entity.email,
        name: entity.name
      }
    }

    // Add entity-specific fields
    if (entityType === 'User') {
      response.user.skills = entity.skills
      response.user.bio = entity.bio
      response.user.location = entity.location
    } else if (entityType === 'Company') {
      response.company.website = entity.website
      response.company.about = entity.about
      response.company.industry = entity.industry
      response.company.logo = entity.logo
    }

    return c.json(response)
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// 5) Get current user profile
router.get('/me', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    
    let entity: any = null

    // Get current user profile
    switch (entityType) {
      case 'User':
        entity = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            userRoles: { include: { role: true } },
            subscription: { include: { plan: true } },
            profile: true
          }
        })
        break

      case 'Company':
        entity = await prisma.company.findUnique({
          where: { id: userId },
          include: {
            companyRoles: { include: { role: true } },
            subscription: { include: { plan: true } },
            profile: true
          }
        })
        break
    }

    if (!entity) {
      return c.json({ error: 'Entity not found' }, 404)
    }

    // Extract roles based on entity type
    let profileRoles: string[] = []
    if (entityType === 'User') {
      profileRoles = entity.userRoles.map((ur: any) => ur.role.name)
    } else if (entityType === 'Company') {
      profileRoles = entity.companyRoles.map((ur: any) => ur.role.name)
    }
    const response: any = {
      entityType,
      [entityType.toLowerCase()]: {
        id: entity.id,
        email: entity.email,
        name: entity.name,
        roles: profileRoles,
        profile: entity.profile?.data
      }
    }

    // Add entity-specific fields
    if (entityType === 'User') {
      response.user.skills = entity.skills
      response.user.bio = entity.bio
      response.user.location = entity.location
      response.user.subscription = entity.subscription
    } else if (entityType === 'Company') {
      response.company.website = entity.website
      response.company.about = entity.about
      response.company.industry = entity.industry
      response.company.logo = entity.logo
      response.company.subscription = entity.subscription
    }

    return c.json(response)
  } catch (error) {
    console.error('Profile fetch error:', error)
    return c.json({ error: 'Failed to fetch profile' }, 500)
  }
})

// 6) Logout
router.post('/logout', requireAuth(), async (c) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // by removing the token. However, we can implement token blacklisting
    // or return a success message for consistency
    return c.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Logout failed' }, 500)
  }
})

export default router
