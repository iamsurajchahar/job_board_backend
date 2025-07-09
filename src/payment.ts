import Razorpay from 'razorpay'

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret'
})

export interface PaymentRequest {
  amount: number
  currency: string
  receipt: string
  notes?: Record<string, string>
}

export interface PaymentResponse {
  id: string
  amount: number
  currency: string
  status: string
  receipt: string
}

export interface PaymentVerification {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

// Create payment order
export async function createPaymentOrder(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
  try {
    // In development, return mock response
    if (process.env.NODE_ENV === 'development' && !process.env.RAZORPAY_KEY_ID) {
      return {
        id: `mock_order_${Date.now()}`,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'created',
        receipt: paymentRequest.receipt
      }
    }

    const order = await razorpay.orders.create({
      amount: paymentRequest.amount * 100, // Convert to paise
      currency: paymentRequest.currency,
      receipt: paymentRequest.receipt,
      notes: paymentRequest.notes
    })

    return {
      id: order.id,
      amount: (order.amount as number) / 100, // Convert back to rupees
      currency: order.currency,
      status: 'created',
      receipt: order.receipt || ''
    }
  } catch (error) {
    console.error('Payment order creation error:', error)
    throw new Error('Failed to create payment order')
  }
}

// Verify payment signature
export async function verifyPayment(verification: PaymentVerification): Promise<boolean> {
  try {
    // In development, always return true for mock payments
    if (process.env.NODE_ENV === 'development' && !process.env.RAZORPAY_KEY_ID) {
      return true
    }

    const crypto = require('crypto')
    const text = verification.razorpay_order_id + '|' + verification.razorpay_payment_id
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex')

    return signature === verification.razorpay_signature
  } catch (error) {
    console.error('Payment verification error:', error)
    return false
  }
}

// Capture payment
export async function capturePayment(paymentId: string, amount: number): Promise<any> {
  try {
    // In development, return mock response
    if (process.env.NODE_ENV === 'development' && !process.env.RAZORPAY_KEY_ID) {
      return {
        id: paymentId,
        amount: amount * 100,
        currency: 'INR',
        status: 'captured'
      }
    }

    return await razorpay.payments.capture(paymentId, amount * 100, 'INR')
  } catch (error) {
    console.error('Payment capture error:', error)
    throw new Error('Failed to capture payment')
  }
} 