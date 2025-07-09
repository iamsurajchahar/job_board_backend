import { Hono } from 'hono'
import { prisma } from '../prismaClient'
import { requireAuth } from '../auth'
import { createPaymentOrder, verifyPayment, capturePayment } from '../payment'

const router = new Hono()

// 1) Create payment order for subscription
router.post('/create-order', requireAuth(), async (c) => {
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

    // Check if plan is free
    if (plan.price === 0) {
      return c.json({ error: 'Free plans do not require payment' }, 400)
    }

    // Get current subscription
    let currentSubscription = null
    if (entityType === 'User') {
      currentSubscription = await prisma.userSubscription.findUnique({
        where: { userId }
      })
    } else if (entityType === 'Company') {
      currentSubscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId }
      })
    }

    // Create payment order
    const paymentOrder = await createPaymentOrder({
      amount: plan.price,
      currency: 'INR',
      receipt: `sub_${entityType.toLowerCase()}_${userId}_${Date.now()}`,
      notes: {
        entityType,
        entityId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name
      }
    })

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        amount: plan.price,
        currency: 'INR',
        status: 'PENDING',
        razorpayOrderId: paymentOrder.id,
        provider: 'razorpay',
        ...(entityType === 'User' 
          ? { userSubscriptionId: currentSubscription?.id }
          : { companySubscriptionId: currentSubscription?.id }
        )
      }
    })

    return c.json({
      message: 'Payment order created successfully',
      order: paymentOrder,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status
      }
    })
  } catch (error) {
    console.error('Payment order creation error:', error)
    return c.json({ error: 'Failed to create payment order' }, 500)
  }
})

// 2) Verify and process payment
router.post('/verify', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await c.req.json()

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return c.json({ error: 'Payment verification details are required' }, 400)
    }

    // Verify payment signature
    const isValid = await verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    })

    if (!isValid) {
      return c.json({ error: 'Invalid payment signature' }, 400)
    }

    // Find payment record
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: {
        userSubscription: { include: { plan: true } },
        companySubscription: { include: { plan: true } }
      }
    })

    if (!payment) {
      return c.json({ error: 'Payment record not found' }, 404)
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        razorpayPaymentId: razorpay_payment_id
      }
    })

    // Activate subscription
    if (payment.userSubscription) {
      await prisma.userSubscription.update({
        where: { id: payment.userSubscription.id },
        data: { status: 'ACTIVE' }
      })
    } else if (payment.companySubscription) {
      await prisma.companySubscription.update({
        where: { id: payment.companySubscription.id },
        data: { status: 'ACTIVE' }
      })
    }

    return c.json({
      message: 'Payment verified and subscription activated successfully',
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: 'COMPLETED'
      }
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    return c.json({ error: 'Failed to verify payment' }, 500)
  }
})

// 3) Get payment history
router.get('/history', requireAuth(), async (c) => {
  try {
    const userId = (c as any).get('userId') as number
    const entityType = (c as any).get('entityType') as string
    const { page = '1', limit = '10' } = c.req.query()
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    let payments: any[] = []
    let total = 0

    if (entityType === 'User') {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId }
      })

      if (subscription) {
        [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where: { userSubscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum
          }),
          prisma.payment.count({
            where: { userSubscriptionId: subscription.id }
          })
        ])
      }
    } else if (entityType === 'Company') {
      const subscription = await prisma.companySubscription.findUnique({
        where: { companyId: userId }
      })

      if (subscription) {
        [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where: { companySubscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum
          }),
          prisma.payment.count({
            where: { companySubscriptionId: subscription.id }
          })
        ])
      }
    }

    return c.json({
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Payment history fetch error:', error)
    return c.json({ error: 'Failed to fetch payment history' }, 500)
  }
})

export default router 