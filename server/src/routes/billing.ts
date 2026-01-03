import express from 'express';
import {
  // Core subscription endpoints
  createSubscription,
  getSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscriptionEmployeeCount,
  // Checkout endpoints
  createCheckoutSession,
  // Module subscription endpoints
  createModuleSubscription,
  getModuleSubscription,
  getUserModuleSubscriptions,
  updateModuleSubscription,
  cancelModuleSubscription,
  // Usage tracking endpoints
  getUsage,
  recordUsage,
  // Invoice endpoints
  getInvoices,
  getInvoice,
  // Developer revenue endpoints
  getDeveloperRevenue,
  // Payment method endpoints
  listPaymentMethods,
  createSetupIntent,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  createCustomerPortalSession,
} from '../controllers/billingController';

const router: express.Router = express.Router();

// Core subscription routes
router.post('/subscriptions', createSubscription);
router.get('/subscriptions/user', getUserSubscription);
router.get('/subscriptions/:id', getSubscription);
router.put('/subscriptions/:id', updateSubscription);
router.put('/subscriptions/:id/employee-count', updateSubscriptionEmployeeCount);
router.delete('/subscriptions/:id', cancelSubscription);
router.post('/subscriptions/:id/reactivate', reactivateSubscription);

// Checkout routes
router.post('/checkout/session', createCheckoutSession);

// Module subscription routes
router.post('/modules/:moduleId/subscribe', createModuleSubscription);
router.get('/modules/subscriptions', getUserModuleSubscriptions);
router.get('/modules/subscriptions/:id', getModuleSubscription);
router.put('/modules/subscriptions/:id', updateModuleSubscription);
router.delete('/modules/subscriptions/:id', cancelModuleSubscription);

// Usage tracking routes
router.get('/usage', getUsage);
router.post('/usage', recordUsage);

// Invoice routes
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoice);

// Developer revenue routes
router.get('/developer/revenue', getDeveloperRevenue);

// Payment method routes
router.get('/payment-methods', listPaymentMethods);
router.post('/payment-methods/setup-intent', createSetupIntent);
router.delete('/payment-methods/:paymentMethodId', deletePaymentMethod);
router.post('/payment-methods/default', setDefaultPaymentMethod);
router.post('/customer-portal', createCustomerPortalSession);

export default router; 