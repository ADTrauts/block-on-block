import express from 'express';
import {
  createBusiness,
  getUserBusinesses,
  getBusiness,
  updateBusiness,
  uploadLogo,
  removeLogo,
  inviteMember,
  acceptInvitation,
  getBusinessMembers,
  updateBusinessMember,
  removeBusinessMember,
  getBusinessAnalytics,
  getBusinessModuleAnalytics,
  followBusiness,
  unfollowBusiness,
  getBusinessFollowers,
  getUserFollowing,
  getBusinessSetupStatus
} from '../controllers/businessController';

const router: express.Router = express.Router();

// Business management routes
router.post('/', createBusiness);
router.get('/', getUserBusinesses);
router.get('/:id/setup-status', getBusinessSetupStatus);
router.get('/:id', getBusiness);
router.put('/:id', updateBusiness);
router.patch('/:id', updateBusiness); // PATCH support for partial updates

// Logo management routes
router.post('/:id/logo', uploadLogo);
router.delete('/:id/logo', removeLogo);

// Member management routes
router.get('/:id/members', getBusinessMembers);
router.put('/:id/members/:userId', updateBusinessMember);
router.delete('/:id/members/:userId', removeBusinessMember);
router.post('/:businessId/invite', inviteMember);
router.post('/invite/accept/:token', acceptInvitation);

// Analytics routes
router.get('/:id/analytics', getBusinessAnalytics);
router.get('/:id/module-analytics', getBusinessModuleAnalytics);

// Follow/unfollow and followers routes
router.post('/:businessId/follow', followBusiness);
router.delete('/:businessId/follow', unfollowBusiness);
router.get('/:businessId/followers', getBusinessFollowers);
router.get('/user/following', getUserFollowing);

export default router; 