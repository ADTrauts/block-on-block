import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { 
  stripe, 
  isStripeConfigured 
} from '../config/stripe';
import { AIQueryService } from './aiQueryService';
import { RevenueSplitService } from './revenueSplitService';

// Stripe webhook event interfaces
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Stripe.Event.Data;
  };
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CreateTransferParams {
  amount: number;
  currency: string;
  destination: string;
  metadata?: Record<string, string>;
}

export interface CreateSetupIntentParams {
  customerId: string;
  paymentMethodTypes?: string[];
  metadata?: Record<string, string>;
}

export interface CreateCustomerPortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface CreateCheckoutSessionParams {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  mode?: 'subscription' | 'payment';
  subscriptionData?: {
    metadata?: Record<string, string>;
  };
}

export class StripeService {
  /**
   * Create a Stripe customer
   */
  static async createCustomer(params: CreateCustomerParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });

    return customer;
  }

  /**
   * Create a subscription
   */
  static async createSubscription(params: CreateSubscriptionParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      metadata: params.metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
  }

  /**
   * Create a checkout session for subscriptions
   */
  static async createCheckoutSession(params: CreateCheckoutSessionParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: params.mode || 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    };

    // Add customer if provided
    if (params.customerId) {
      sessionParams.customer = params.customerId;
    } else if (params.customerEmail) {
      sessionParams.customer_email = params.customerEmail;
    }

    // Add subscription metadata if provided
    if (params.subscriptionData?.metadata) {
      sessionParams.subscription_data = {
        metadata: params.subscriptionData.metadata,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return session;
  }

  /**
   * Create a payment intent
   */
  static async createPaymentIntent(params: CreatePaymentIntentParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: params.amount,
      currency: params.currency || 'usd',
      metadata: params.metadata,
    };

    if (params.customerId) {
      paymentIntentParams.customer = params.customerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return paymentIntent;
  }

  /**
   * Create a product
   */
  static async createProduct(name: string, description: string, metadata?: Record<string, string>) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const product = await stripe.products.create({
      name,
      description,
      metadata,
    });

    return product;
  }

  /**
   * Create a price
   */
  static async createPrice(
    productId: string,
    unitAmount: number,
    currency: string = 'usd',
    options?: { 
      interval?: 'month' | 'year';
      metadata?: Record<string, string>;
    }
  ) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const priceParams: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: unitAmount,
      currency,
    };

    if (options?.interval) {
      priceParams.recurring = {
        interval: options.interval,
      };
    }

    if (options?.metadata) {
      priceParams.metadata = options.metadata;
    }

    const price = await stripe.prices.create(priceParams);

    return price;
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'setup_intent.succeeded':
        await this.handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
    }
  }

  /**
   * Alias for handleWebhook (for consistency with PaymentService)
   */
  static async handleWebhookEvent(event: Stripe.Event) {
    return this.handleWebhook(event);
  }

  /**
   * Handle successful payment intent (for query packs and other one-time payments)
   */
  private static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentType = paymentIntent.metadata.type;

    if (paymentType === 'ai_query_pack') {
      // Handle AI query pack purchase
      const { AIQueryService } = await import('./aiQueryService');
      await AIQueryService.completeQueryPackPurchase(paymentIntent.id);
    }
    // Other payment intent types can be handled here
  }

  /**
   * Handle failed payment intent
   */
  private static async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const paymentType = paymentIntent.metadata.type;

    if (paymentType === 'ai_query_pack') {
      // Handle failed AI query pack purchase
      const { AIQueryService } = await import('./aiQueryService');
      await AIQueryService.failQueryPackPurchase(paymentIntent.id);
    }
  }

  /**
   * Handle setup intent succeeded - attach payment method to customer
   */
  private static async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
    try {
      // The payment method is already attached to the customer when setup intent succeeds
      // We just need to log it or perform any additional actions
      console.log('Setup intent succeeded:', setupIntent.id);
      
      if (setupIntent.payment_method && typeof setupIntent.payment_method === 'string') {
        const paymentMethod = await stripe!.paymentMethods.retrieve(setupIntent.payment_method);
        console.log('Payment method attached:', paymentMethod.id, 'to customer:', paymentMethod.customer);
      }
    } catch (error) {
      console.error('Error handling setup intent succeeded:', error);
    }
  }

  private static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      // Get subscription from session
      if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        const subscription = await stripe!.subscriptions.retrieve(session.subscription);
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const businessId = session.metadata?.businessId;

        if (userId && tier) {
          // Update or create subscription in database
          const subscriptionData = {
            userId,
            businessId: businessId || null,
            tier,
            status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'cancelled',
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
          };

          // Check if subscription already exists
          const existing = await prisma.subscription.findFirst({
            where: {
              userId,
              businessId: businessId || null,
            },
          });

          if (existing) {
            await prisma.subscription.update({
              where: { id: existing.id },
              data: subscriptionData,
            });
          } else {
            await prisma.subscription.create({
              data: subscriptionData,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling checkout session completed:', error);
    }
  }

  private static async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    console.log('Payment succeeded:', invoice.id);
    
    // Update invoice record
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    });

    // Handle revenue sharing for module subscriptions
    const subscription = (invoice as any).subscription;
    const subscriptionId = typeof subscription === 'string' 
      ? subscription 
      : subscription?.id || null;
    if (subscriptionId) {
      const moduleSubscription = await prisma.moduleSubscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        include: { module: true },
      });

      if (moduleSubscription && moduleSubscription.module.isProprietary === false) {
        // Calculate subscription age for revenue split
        const subscriptionAgeMonths = RevenueSplitService.calculateSubscriptionAgeMonths(
          moduleSubscription.currentPeriodStart
        );
        
        // Calculate revenue split using Apple-style model
        const revenueSplit = await RevenueSplitService.calculateDeveloperShare(
          moduleSubscription.moduleId,
          invoice.amount_paid / 100, // Convert from cents to dollars
          subscriptionAgeMonths
        );

        // Record developer revenue
        await prisma.developerRevenue.create({
          data: {
            developerId: moduleSubscription.module.developerId,
            moduleId: moduleSubscription.moduleId,
            periodStart: new Date(),
            periodEnd: new Date(),
            totalRevenue: invoice.amount_paid / 100, // Convert from cents to dollars
            platformRevenue: revenueSplit.platformShare,
            developerRevenue: revenueSplit.developerShare,
            commissionRate: revenueSplit.commissionRate,
            commissionType: revenueSplit.commissionType,
            subscriptionAgeMonths,
            isFirstYear: subscriptionAgeMonths <= 12,
            payoutStatus: 'pending',
          },
        });
      }
    }
  }

  /**
   * Handle payment failed
   */
  private static async handlePaymentFailed(invoice: Stripe.Invoice) {
    console.log('Payment failed:', invoice.id);
    
    // Update invoice record
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'uncollectible',
      },
    });

    // Update subscription status
    const subscription = (invoice as any).subscription;
    const subscriptionId = typeof subscription === 'string' 
      ? subscription 
      : subscription?.id || null;
    if (subscriptionId) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'past_due' },
      });
    }
  }

  /**
   * Handle subscription deleted
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'cancelled',
      },
    });
  }

  /**
   * Create a transfer (for payouts)
   */
  static async createTransfer(params: CreateTransferParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const transfer = await stripe.transfers.create({
      amount: params.amount,
      currency: params.currency,
      destination: params.destination,
      metadata: params.metadata,
    });

    return transfer;
  }

  /**
   * Create a setup intent for collecting payment methods
   */
  static async createSetupIntent(params: CreateSetupIntentParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: params.customerId,
      payment_method_types: params.paymentMethodTypes || ['card'],
      metadata: params.metadata,
    });

    return setupIntent;
  }

  /**
   * List payment methods for a customer
   */
  static async listPaymentMethods(customerId: string) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods;
  }

  /**
   * Detach a payment method from a customer
   */
  static async detachPaymentMethod(paymentMethodId: string) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return paymentMethod;
  }

  /**
   * Set default payment method for a customer
   */
  static async setDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const customer = await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return customer;
  }

  /**
   * Create a customer portal session
   */
  static async createCustomerPortalSession(params: CreateCustomerPortalSessionParams) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return session;
  }

  /**
   * Cancel a Stripe subscription
   */
  static async cancelSubscription(subscriptionId: string) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    return subscription;
  }

  /**
   * Reactivate a Stripe subscription
   */
  static async reactivateSubscription(subscriptionId: string) {
    if (!isStripeConfigured() || !stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    return subscription;
  }
}
