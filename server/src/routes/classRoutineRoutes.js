import express from 'express';
import {
  uploadClassRoutinePDF,
  getClassRoutinePDFs,
  deleteClassRoutinePDF,
  updateClassRoutinePDF,
  getClassRoutinePresignedUrl,
} from '../controllers/classRoutineController.js';

const classRoutineRouter = express.Router();

classRoutineRouter.get('/presigned-url', getClassRoutinePresignedUrl);
classRoutineRouter.post('/pdf', uploadClassRoutinePDF);
classRoutineRouter.get('/pdf', getClassRoutinePDFs);
classRoutineRouter.delete('/pdf/:id', deleteClassRoutinePDF);
classRoutineRouter.put('/pdf/:id', updateClassRoutinePDF);

export default classRoutineRouter;
