import { Router } from 'express';
import { PromotionController } from './promotion.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/updateStatus/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.updatePassFailStatus,
);
router.post(
  '/addPromotion/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.promoteStudents,
);
router.put(
  '/updateStatus',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.updateStatus,
);

const promotionRouter = router.use('/api/promotion', router);
export default promotionRouter;
