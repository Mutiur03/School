import { Router } from 'express';
import { PromotionController } from './promotion.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/updateStatus/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.updatePassFailStatus,
);
router.get(
  '/pass-rules/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.getPassRules,
);
router.put(
  '/pass-rules/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.savePassRules,
);
router.post(
  '/addPromotion/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.promoteStudents,
);
router.get(
  '/preview/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.previewPromotion,
);
router.get(
  '/stats/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.getYearStats,
);
router.get(
  '/graduation/preview/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.previewGraduation,
);
router.post(
  '/graduation/:year',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.graduateStudents,
);
router.put(
  '/updateStatus',
  AuthMiddleware.authenticate(['admin']),
  PromotionController.updateStatus,
);

const promotionRouter = router.use('/api/promotion', router);
export default promotionRouter;
