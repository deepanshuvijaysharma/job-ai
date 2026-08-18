import { Router } from 'express';
import { getApplications, prepareApplicationData, updateApplicationStatus } from '../controllers/applicationController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateJWT, getApplications);
router.post('/status', authenticateJWT, updateApplicationStatus);
router.get('/prepare/:jobId', authenticateJWT, prepareApplicationData);

export default router;
