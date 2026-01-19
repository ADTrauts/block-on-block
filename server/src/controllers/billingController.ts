import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { ModuleSubscriptionService } from '../services/moduleSubscriptionService';
import { StripeService } from '../services/stripeService';
import { PricingService } from '../services/pricingService';
import { UsageTrackingService } from '../services/usageTrackingService';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { isStripeConfigured } from '../config/stripe';
const subscriptionService = new SubscriptionService();
const moduleSubscriptionService = new ModuleSubscriptionService();

// Core subscription endpoints

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { tier, businessId, stripeCustomerId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!tier || !['free', 'standard', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const subscription = await subscriptionService.createSubscription({
      userId,
      businessId,
      tier,
      stripeCustomerId,
    });

    res.status(201).json({ subscription });
  } catch (error) {
    await logger.error('Failed to create subscription', {
      operation: 'billing_create_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { tier, billingCycle = 'monthly', businessId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    if (!tier || !['pro', 'business_basic', 'business_advanced', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be pro, business_basic, business_advanced, or enterprise' });
    }

    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return res.status(400).json({ error: 'Invalid billing cycle. Must be monthly or yearly' });
    }

    // Get pricing configuration to find Stripe price ID
    const pricing = await PricingService.getPricing(tier, billingCycle);
    if (!pricing || !pricing.stripePriceId) {
      return res.status(400).json({ 
        error: `No Stripe price ID configured for ${tier} (${billingCycle}). Please configure pricing in the admin portal.` 
      });
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      const customer = await StripeService.createCustomer({
        email: user.email || '',
        name: user.name || undefined,
        metadata: { userId },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id } as any,
      });

      customerId = customer.id;
    }

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing/cancel`;

    // Create checkout session
    const session = await StripeService.createCheckoutSession({
      customerId,
      priceId: pricing.stripePriceId,
      successUrl,
      cancelUrl,
      mode: 'subscription',
      metadata: {
        userId,
        tier,
        billingCycle,
        businessId: businessId || '',
      },
      subscriptionData: {
        metadata: {
          userId,
          tier,
          billingCycle,
          businessId: businessId || '',
        },
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    await logger.error('Failed to create checkout session', {
      operation: 'billing_create_checkout_session',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Check if user has access to this subscription
    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ subscription });
  } catch (error) {
    await logger.error('Failed to get subscription', {
      operation: 'billing_get_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get subscription' });
  }
};

export const getUserSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionService.getUserSubscription(userId);

    res.json({ subscription });
  } catch (error) {
    await logger.error('Failed to get user subscription', {
      operation: 'billing_get_user_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get user subscription' });
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tier, businessId, cancelAtPeriodEnd } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await subscriptionService.updateSubscription({
      subscriptionId: id,
      tier,
      cancelAtPeriodEnd,
    });

    res.json({ subscription: updated });
  } catch (error) {
    await logger.error('Failed to update subscription', {
      operation: 'billing_update_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await subscriptionService.cancelSubscription(id);

    res.json({ message: 'Subscription cancelled' });
  } catch (error) {
    await logger.error('Failed to cancel subscription', {
      operation: 'billing_cancel_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await subscriptionService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await subscriptionService.reactivateSubscription(id);

    res.json({ message: 'Subscription reactivated' });
  } catch (error) {
    await logger.error('Failed to reactivate subscription', {
      operation: 'billing_reactivate_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
};

export const updateSubscriptionEmployeeCount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { employeeCount } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (employeeCount === undefined || employeeCount < 0) {
      return res.status(400).json({ error: 'Valid employee count is required' });
    }

    const subscription = await subscriptionService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await subscriptionService.updateEmployeeCount(id, employeeCount);

    res.json({ subscription: updated });
  } catch (error) {
    await logger.error('Failed to update subscription employee count', {
      operation: 'billing_update_subscription_employee_count',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update subscription employee count' });
  }
};

// Module subscription endpoints

export const createModuleSubscription = async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { tier, businessId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await moduleSubscriptionService.createModuleSubscription({
      userId,
      businessId,
      moduleId,
      tier: tier || 'premium',
    });

    res.status(201).json({ subscription });
  } catch (error) {
    await logger.error('Failed to create module subscription', {
      operation: 'billing_create_module_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to create module subscription' });
  }
};

export const getModuleSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await moduleSubscriptionService.getModuleSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Module subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ subscription });
  } catch (error) {
    await logger.error('Failed to get module subscription', {
      operation: 'billing_get_module_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get module subscription' });
  }
};

export const getUserModuleSubscriptions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscriptions = await moduleSubscriptionService.getUserModuleSubscriptions(userId);

    res.json({ subscriptions });
  } catch (error) {
    await logger.error('Failed to get user module subscriptions', {
      operation: 'billing_get_user_module_subscriptions',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get user module subscriptions' });
  }
};

export const updateModuleSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tier, status } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await moduleSubscriptionService.getModuleSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Module subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await moduleSubscriptionService.updateModuleSubscription({
      subscriptionId: id,
      tier,
      status,
    });

    res.json({ subscription: updated });
  } catch (error) {
    await logger.error('Failed to update module subscription', {
      operation: 'billing_update_module_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to update module subscription' });
  }
};

export const cancelModuleSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await moduleSubscriptionService.getModuleSubscription(id);

    if (!subscription) {
      return res.status(404).json({ error: 'Module subscription not found' });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await moduleSubscriptionService.cancelModuleSubscription(id);

    res.json({ message: 'Module subscription cancelled' });
  } catch (error) {
    await logger.error('Failed to cancel module subscription', {
      operation: 'billing_cancel_module_subscription',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to cancel module subscription' });
  }
};

// Usage tracking endpoints

export const getUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { businessId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use UsageTrackingService to get usage data
    const usageLimits = await UsageTrackingService.getAllUsage(
      userId,
      businessId ? (businessId as string) : undefined
    );

    // Transform UsageLimit[] to the format expected by frontend (UsageData)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Format metric names for display
    const formatMetricName = (metric: string): string => {
      return metric
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // Transform to UsageRecord format
    const coreUsage = usageLimits.map(limit => ({
      date: new Date().toISOString(),
      value: limit.currentUsage,
      unit: limit.metric === 'storage_gb' ? 'GB' : limit.metric === 'api_calls' ? 'calls' : limit.metric === 'messages' ? 'messages' : 'items',
      description: `${formatMetricName(limit.metric)}: ${limit.currentUsage}${limit.limit === -1 ? ' (unlimited)' : ` / ${limit.limit}`}`,
    }));

    // For now, moduleUsage is empty (can be extended later)
    const moduleUsage: Array<{
      moduleId: string;
      moduleName: string;
      usage: Array<{
        date: string;
        value: number;
        unit: string;
        description: string;
      }>;
    }> = [];

    const usage = {
      coreUsage,
      moduleUsage,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
    };

    res.json(usage);
  } catch (error) {
    await logger.error('Failed to get usage', {
      operation: 'billing_get_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get usage' });
  }
};

export const recordUsage = async (req: Request, res: Response) => {
  try {
    const { subscriptionId, metric, quantity, cost } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usage = await subscriptionService.recordUsage(subscriptionId, metric, quantity, cost);

    res.status(201).json({ usage });
  } catch (error) {
    await logger.error('Failed to record usage', {
      operation: 'billing_record_usage',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to record usage' });
  }
};

// Invoice endpoints

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invoices });
  } catch (error) {
    await logger.error('Failed to get invoices', {
      operation: 'billing_get_invoices',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get invoices' });
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ invoice });
  } catch (error) {
    await logger.error('Failed to get invoice', {
      operation: 'billing_get_invoice',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get invoice' });
  }
};

// Developer revenue endpoints

export const getDeveloperRevenue = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const revenue = await moduleSubscriptionService.getDeveloperRevenue(userId, new Date(0), new Date());

    res.json({ revenue });
  } catch (error) {
    await logger.error('Failed to get developer revenue', {
      operation: 'billing_get_developer_revenue',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.status(500).json({ error: 'Failed to get developer revenue' });
  }
};

// Payment method endpoints

export const listPaymentMethods = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If Stripe is not configured, return empty array (graceful degradation)
    if (!isStripeConfigured()) {
      return res.json({ paymentMethods: [] });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).stripeCustomerId) {
      return res.json({ paymentMethods: [] });
    }

    const paymentMethods = await StripeService.listPaymentMethods((user as any).stripeCustomerId);

    res.json({ paymentMethods: paymentMethods.data });
  } catch (error) {
    await logger.error('Failed to list payment methods', {
      operation: 'billing_list_payment_methods',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    // Return empty array on error instead of 500 (graceful degradation)
    res.json({ paymentMethods: [] });
  }
};

export const createSetupIntent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    // Get or create customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = (user as any).stripeCustomerId;
    if (!customerId) {
      const customer = await StripeService.createCustomer({
        email: user.email || '',
        name: user.name || undefined,
        metadata: { userId },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id } as any,
      });

      customerId = customer.id;
    }

    const setupIntent = await StripeService.createSetupIntent({
      customerId,
      metadata: { userId },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    await logger.error('Failed to create setup intent', {
      operation: 'billing_create_setup_intent',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    // Verify the payment method belongs to the user's customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).stripeCustomerId) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const paymentMethods = await StripeService.listPaymentMethods((user as any).stripeCustomerId);
    const paymentMethod = paymentMethods.data.find(pm => pm.id === paymentMethodId);

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    await StripeService.detachPaymentMethod(paymentMethodId);

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    await logger.error('Failed to delete payment method', {
      operation: 'billing_delete_payment_method',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
};

export const setDefaultPaymentMethod = async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    // Verify the payment method belongs to the user's customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).stripeCustomerId) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const paymentMethods = await StripeService.listPaymentMethods((user as any).stripeCustomerId);
    const paymentMethod = paymentMethods.data.find(pm => pm.id === paymentMethodId);

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    await StripeService.setDefaultPaymentMethod((user as any).stripeCustomerId, paymentMethodId);

    res.json({ message: 'Default payment method updated successfully' });
  } catch (error) {
    await logger.error('Failed to set default payment method', {
      operation: 'billing_set_default_payment_method',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
};

export const createCustomerPortalSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(user as any).stripeCustomerId) {
      return res.status(404).json({ error: 'No customer found. Please create a subscription first.' });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/billing`;

    const session = await StripeService.createCustomerPortalSession({
      customerId: (user as any).stripeCustomerId,
      returnUrl,
    });

    res.json({
      url: session.url,
    });
  } catch (error) {
    await logger.error('Failed to create customer portal session', {
      operation: 'billing_create_customer_portal_session',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
};
