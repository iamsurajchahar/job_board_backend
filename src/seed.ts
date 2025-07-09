import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create roles
  console.log('Creating roles...')
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'User' },
      update: {},
      create: { name: 'User' }
    }),
    prisma.role.upsert({
      where: { name: 'Company' },
      update: {},
      create: { name: 'Company' }
    })
  ])

  console.log('✅ Roles created:', roles.map(r => r.name))

  // Create plans
  console.log('Creating subscription plans...')
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'Free Plan' },
      update: {},
      create: {
        name: 'Free Plan',
        description: 'Basic plan with limited features',
        type: 'FREE' as any,
        userApplicationsLimit: 5,
        companyJobsLimit: 1,
        companyInternshipsLimit: 2,
        price: 0,
        duration: 30,
        features: {
          jobApplications: 5,
          jobPostings: 1,
          internshipPostings: 2,
          basicSupport: true
        }
      }
    }),
    prisma.plan.upsert({
      where: { name: 'Premium Plan' },
      update: {},
      create: {
        name: 'Premium Plan',
        description: 'Premium plan with unlimited features',
        type: 'PREMIUM' as any,
        userApplicationsLimit: 999999,
        companyJobsLimit: 999999,
        companyInternshipsLimit: 999999,
        price: 29.99,
        duration: 30,
        features: {
          jobApplications: 'unlimited',
          jobPostings: 'unlimited',
          internshipPostings: 'unlimited',
          prioritySupport: true,
          analytics: true,
          featuredListings: true
        }
      }
    })
  ])

  console.log('✅ Plans created:', plans.map(p => p.name))

  // Create a default company for testing
  console.log('Creating default company...')
  const defaultCompany = await prisma.company.upsert({
    where: { email: 'test@company.com' },
    update: {},
    create: {
      email: 'test@company.com',
      password: await import('bcryptjs').then(bcrypt => bcrypt.hash('company123', 10)),
      name: 'Test Company',
      about: 'A test company for job posting',
      industry: 'Technology'
    }
  })

  console.log('✅ Default company created: test@company.com / company123')

  console.log('🎉 Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 