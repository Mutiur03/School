import { Router } from 'express';
import { HolidayController } from './holiday.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

const router = Router();

router.get('/getHolidays', HolidayController.getHolidays);
router.post('/addHoliday', AuthMiddleware.authenticate(['admin']), HolidayController.addHoliday);
router.put(
  '/updateHoliday/:id',
  AuthMiddleware.authenticate(['admin']),
  HolidayController.updateHoliday,
);
router.delete(
  '/deleteHoliday/:id',
  AuthMiddleware.authenticate(['admin']),
  HolidayController.deleteHoliday,
);

const holidayRouter = router.use('/api/holidays', router);
export default holidayRouter;
