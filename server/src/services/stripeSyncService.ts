import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { getStripeClient, isStripeConfigured } from '../config/stripe';
import { logger } from '../lib/logger';

export class StripeSyncService {
  /**
   * Sync subscription data from Stripe
   */
  static async syncSubscriptionFromStripe(subscriptionId: string): Promise<void> {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not available');
    }

    try {
      // Find subscription in database
      const dbSubscription = await prisma.subscription.findFirst({
        where: {
          OR: [
            { id: subscriptionId },
            { stripeSubscriptionId: subscriptionId }
          ]
        }
      });

      if (!dbSubscription?.stripeSubscriptionId) {
        throw new Error('Subscription not found or has no Stripe ID');
      }

      // Fetch from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        dbSubscription.stripeSubscriptionId,
        { expand: ['customer', 'items.data.price.product'] }
      );

      // Map Stripe status to our status
      const statusMap: Record<string, string> = {
        'active': 'active',
        'canceled': 'cancelled',
        'past_due': 'past_due',
        'unpaid': 'unpaid',
        'incomplete': 'unpaid',
        'incomplete_expired': 'unpaid',
        'trialing': 'active',
        'paused': 'cancelled'
      };

      // Calculate total amount from subscription items
      let totalAmount = 0;
      if (stripeSubscription.items?.data) {
        for (const item of stripeSubscription.items.data) {
          if (item.price?.unit_amount) {
            const itemAmount = (item.price.unit_amount / 100) * (item.quantity || 1);
            totalAmount += itemAmount;
          }
        }
      }

      // Update subscription in database
      await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status: statusMap[stripeSubscription.status] || 'unpaid',
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          lastSyncedAt: new Date(),
          stripeMetadata: {
            stripeStatus: stripeSubscription.status,
            collectionMethod: stripeSubscription.collection_method,
            billingCycleAnchor: stripeSubscription.billing_cycle_anchor,
            cancelAt: stripeSubscription.cancel_at,
            canceledAt: stripeSubscription.canceled_at,
            currentPeriodStart: stripeSubscription.current_period_start,
            currentPeriodEnd: stripeSubscription.current_period_end,
            items: stripeSubscription.items?.data?.map(item => ({
              priceId: item.price?.id,
              quantity: item.quantity,
              amount: item.price?.unit_amount ? item.price.unit_amount / 100 : 0
            })) || []
          } as any
        }
      });

      await logger.info('Synced subscription from Stripe', {
        operation: 'stripe_sync_subscription',
        subscriptionId: dbSubscription.id,
        stripeSubscriptionId: dbSubscription.stripeSubscriptionId
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Failed to sync subscription from Stripe', {
        operation: 'stripe_sync_subscription',
        subscriptionId,
        error: { message: err.message, stack: err.stack }
      });
      throw error;
    }
  }

  /**
   * Sync invoice data from Stripe
   */
  static async syncInvoiceFromStripe(invoiceId: string): Promise<void> {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not available');
    }

    try {
      // Find invoice in database
      const dbInvoice = await prisma.invoice.findFirst({
        where: {
          OR: [
            { id: invoiceId },
            { stripeInvoiceId: invoiceId }
          ]
        }
      });

      if (!dbInvoice?.stripeInvoiceId) {
        throw new Error('Invoice not found or has no Stripe ID');
      }

      // Fetch from Stripe
      const stripeInvoice = await stripe.invoices.retrieve(
        dbInvoice.stripeInvoiceId,
        { expand: ['charge', 'payment_intent', 'subscription'] }
      );

      // Get charge details if available
      const charge = stripeInvoice.charge as Stripe.Charge | null;
      const paymentIntent = stripeInvoice.payment_intent as Stripe.PaymentIntent | null;

      // Calculate Stripe fees (if charge exists)
      let stripeFee = 0;
      let netAmount = stripeInvoice.amount_paid / 100;
      
      if (charge?.balance_transaction) {
        const balanceTransaction = await stripe.balanceTransactions.retrieve(
          charge.balance_transaction as string
        );
        stripeFee = balanceTransaction.fee / 100;
        netAmount = balanceTransaction.net / 100;
      }

      // Get refunds
      let refundAmount = 0;
      let refundCount = 0;
      
      if (charge?.id) {
        const refunds = await stripe.refunds.list({ charge: charge.id });
        refundAmount = refunds.data.reduce((sum, refund) => sum + (refund.amount / 100), 0);
        refundCount = refunds.data.length;

        // Sync refunds to database
        for (const refund of refunds.data) {
          await prisma.refund.upsert({
            where: { stripeRefundId: refund.id },
            create: {
              invoiceId: dbInvoice.id,
              amount: refund.amount / 100,
              currency: refund.currency,
              reason: refund.reason || null,
              status: refund.status,
              stripeRefundId: refund.id,
              stripeChargeId: charge.id,
              createdAt: new Date(refund.created * 1000),
              processedAt: refund.status === 'succeeded' ? new Date(refund.created * 1000) : null
            },
            update: {
              status: refund.status,
              processedAt: refund.status === 'succeeded' ? new Date(refund.created * 1000) : null
            }
          });
        }
      }

      // Map Stripe status to our status
      const statusMap: Record<string, string> = {
        'draft': 'draft',
        'open': 'open',
        'paid': 'paid',
        'void': 'void',
        'uncollectible': 'uncollectible'
      };

      // Update invoice in database
      await prisma.invoice.update({
        where: { id: dbInvoice.id },
        data: {
          amount: stripeInvoice.amount_paid / 100,
          status: statusMap[stripeInvoice.status] || stripeInvoice.status,
          dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
          paidAt: stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at
            ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
            : dbInvoice.paidAt,
          stripeChargeId: charge?.id || null,
          stripePaymentIntentId: paymentIntent?.id || null,
          stripeCustomerId: typeof stripeInvoice.customer === 'string' 
            ? stripeInvoice.customer 
            : (stripeInvoice.customer as Stripe.Customer)?.id || null,
          stripeFee,
          stripeNetAmount: netAmount,
          refundAmount,
          refundCount,
          lastSyncedAt: new Date(),
          stripeMetadata: {
            stripeStatus: stripeInvoice.status,
            subtotal: stripeInvoice.subtotal / 100,
            total: stripeInvoice.total / 100,
            amountDue: stripeInvoice.amount_due / 100,
            amountPaid: stripeInvoice.amount_paid / 100,
            currency: stripeInvoice.currency,
            billingReason: stripeInvoice.billing_reason,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
            invoicePdf: stripeInvoice.invoice_pdf,
            paymentMethod: paymentIntent?.payment_method 
              ? (await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string)).type
              : null,
            chargeDetails: charge ? {
              id: charge.id,
              amount: charge.amount / 100,
              currency: charge.currency,
              status: charge.status,
              paid: charge.paid,
              refunded: charge.refunded,
              paymentMethod: charge.payment_method_details?.type
            } : null
          } as any
        }
      });

      await logger.info('Synced invoice from Stripe', {
        operation: 'stripe_sync_invoice',
        invoiceId: dbInvoice.id,
        stripeInvoiceId: dbInvoice.stripeInvoiceId
      });
    } catch (error) {
      const err = error as Error;
      await logger.error('Failed to sync invoice from Stripe', {
        operation: 'stripe_sync_invoice',
        invoiceId,
        error: { message: err.message, stack: err.stack }
      });
      throw error;
    }
  }

  /**
   * Sync all subscriptions for a user or business
   */
  static async syncAllSubscriptions(filters?: { userId?: string; businessId?: string }): Promise<number> {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const where: Record<string, unknown> = {
      stripeSubscriptionId: { not: null }
    };

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.businessId) {
      where.businessId = filters.businessId;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      select: { id: true, stripeSubscriptionId: true }
    });

    let synced = 0;
    for (const subscription of subscriptions) {
      try {
        if (subscription.stripeSubscriptionId) {
          await this.syncSubscriptionFromStripe(subscription.id);
          synced++;
        }
      } catch (error) {
        // Continue with other subscriptions even if one fails
        console.error(`Failed to sync subscription ${subscription.id}:`, error);
      }
    }

    return synced;
  }

  /**
   * Sync all invoices for a subscription
   */
  static async syncInvoicesForSubscription(subscriptionId: string): Promise<number> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { invoices: true }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    let synced = 0;
    for (const invoice of subscription.invoices) {
      if (invoice.stripeInvoiceId) {
        try {
          await this.syncInvoiceFromStripe(invoice.id);
          synced++;
        } catch (error) {
          // Continue with other invoices even if one fails
          console.error(`Failed to sync invoice ${invoice.id}:`, error);
        }
      }
    }

    return synced;
  }

  /**
   * Get Stripe Dashboard URL for a subscription
   */
  static getStripeSubscriptionUrl(stripeSubscriptionId: string | null | undefined): string | null {
    if (!stripeSubscriptionId) return null;
    const env = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
    return `https://dashboard.stripe.com/${env}/subscriptions/${stripeSubscriptionId}`;
  }

  /**
   * Get Stripe Dashboard URL for an invoice
   */
  static getStripeInvoiceUrl(stripeInvoiceId: string | null | undefined): string | null {
    if (!stripeInvoiceId) return null;
    const env = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
    return `https://dashboard.stripe.com/${env}/invoices/${stripeInvoiceId}`;
  }

  /**
   * Get Stripe Dashboard URL for a customer
   */
  static getStripeCustomerUrl(stripeCustomerId: string | null | undefined): string | null {
    if (!stripeCustomerId) return null;
    const env = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
    return `https://dashboard.stripe.com/${env}/customers/${stripeCustomerId}`;
  }
}

