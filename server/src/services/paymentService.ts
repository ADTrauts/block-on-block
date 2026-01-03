import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
// Initialize Stripe with default API version from SDK types
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {}) : null;

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export interface SubscriptionData {
  moduleId: string;
  userId: string;
  businessId?: string;
  tier: 'premium' | 'enterprise';
  amount: number;
  interval: 'month' | 'year';
}

export interface StripeSubscriptionData {
  id: string;
  current_period_start: number;
  current_period_end: number;
  data?: unknown;
}

export interface ModuleSubscriptionResult {
  subscription: unknown; // Will be defined by Prisma model
  stripeSubscription: StripeSubscriptionData;
}

export class PaymentService {
  /**
   * Create a payment intent for module subscription
   */
  static async createModulePaymentIntent(data: SubscriptionData): Promise<PaymentIntent> {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    // Get module details
    const module = await prisma.module.findUnique({
      where: { id: data.moduleId },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    // Calculate amount based on tier
    const amount = data.tier === 'premium' ? module.basePrice : module.enterprisePrice || module.basePrice;
    const amountInCents = Math.round(amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        moduleId: data.moduleId,
        userId: data.userId,
        businessId: data.businessId || '',
        tier: data.tier,
        type: 'module_subscription',
      },
    });

    return {
      id: paymentIntent.id,
      amount: amountInCents,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      client_secret: paymentIntent.client_secret!,
    };
  }

  /**
   * Create a subscription for a module
   */
  static async createModuleSubscription(data: SubscriptionData): Promise<ModuleSubscriptionResult> {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    // Get or create customer
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Get module details
    const module = await prisma.module.findUnique({
      where: { id: data.moduleId },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    // Create product and price if they don't exist
    let productId = module.stripeProductId;
    let priceId = module.stripePriceId;

    if (!productId) {
      const product = await stripe.products.create({
        name: module.name,
        description: module.description,
        metadata: {
          moduleId: module.id,
          developerId: module.developerId,
        },
      });

      productId = product.id;

      // Update module with Stripe product ID
      await prisma.module.update({
        where: { id: module.id },
        data: { stripeProductId: productId },
      });
    }

    if (!priceId) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(module.basePrice * 100),
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          moduleId: module.id,
          tier: 'premium',
        },
      });

      priceId = price.id;

      // Update module with Stripe price ID
      await prisma.module.update({
        where: { id: module.id },
        data: { stripePriceId: priceId },
      });
    }

    // Create subscription
    const createdSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        moduleId: module.id,
        userId: user.id,
        businessId: data.businessId || '',
        tier: data.tier,
        type: 'module_subscription',
      },
    });
    const subscription: StripeSubscriptionData = (createdSubscription as any)?.data ?? createdSubscription as any;

    // Create module subscription record
    const moduleSubscription = await prisma.moduleSubscription.create({
      data: {
        userId: user.id,
        businessId: data.businessId,
        moduleId: module.id,
        tier: data.tier,
        status: 'active',
        currentPeriodStart: new Date((subscription.current_period_start as unknown as number) * 1000),
        currentPeriodEnd: new Date((subscription.current_period_end as unknown as number) * 1000),
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        amount: module.basePrice,
        platformRevenue: module.isProprietary ? module.basePrice : module.basePrice * (1 - module.revenueSplit),
        developerRevenue: module.isProprietary ? 0 : module.basePrice * module.revenueSplit,
      },
    });

    return {
      subscription: moduleSubscription,
      stripeSubscription: subscription,
    };
  }

  /**
   * Cancel a module subscription
   */
  static async cancelModuleSubscription(subscriptionId: string): Promise<unknown> {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    const subscription = await prisma.moduleSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update local subscription
    const updatedSubscription = await prisma.moduleSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        cancelAtPeriodEnd: true,
      },
    });

    return updatedSubscription;
  }

  /**
   * Reactivate a cancelled subscription
   */
  static async reactivateModuleSubscription(subscriptionId: string): Promise<unknown> {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    const subscription = await prisma.moduleSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Reactivate Stripe subscription
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    // Update local subscription
    const updatedSubscription = await prisma.moduleSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    });

    return updatedSubscription;
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private static async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentType = paymentIntent.metadata.type;

    if (paymentType === 'module_subscription') {
      // Handle module subscription payment
      const moduleId = paymentIntent.metadata.moduleId;
      const userId = paymentIntent.metadata.userId;
      const tier = paymentIntent.metadata.tier as 'premium' | 'enterprise';

      // Create module subscription
      await this.createModuleSubscription({
        moduleId,
        userId,
        tier,
        amount: paymentIntent.amount / 100,
        interval: 'month',
      });
    } else if (paymentType === 'ai_query_pack') {
      // Handle AI query pack purchase
      const { AIQueryService } = await import('./aiQueryService');
      await AIQueryService.completeQueryPackPurchase(paymentIntent.id);
    }
  }

  private static async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentType = paymentIntent.metadata.type;

    if (paymentType === 'ai_query_pack') {
      // Handle failed AI query pack purchase
      const { AIQueryService } = await import('./aiQueryService');
      await AIQueryService.failQueryPackPurchase(paymentIntent.id);
    } else {
      // Handle other failed payments
      console.log('Payment failed:', paymentIntent.id);
    }
  }

  private static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Handle successful invoice payment
    console.log('Invoice payment succeeded:', invoice.id);
  }

  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Handle failed invoice payment
    console.log('Invoice payment failed:', invoice.id);
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Update local subscription status
    await prisma.moduleSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'cancelled' },
    });
  }
} 