import { Router } from 'express';
import { getBestJobsToday, getJobAlerts, getJobById, getJobs, importJobUrl, triggerDiscovery } from '../controllers/jobController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateJWT, getJobs);
router.get('/today', authenticateJWT, getBestJobsToday);
router.get('/alerts', authenticateJWT, getJobAlerts);
router.get('/:id', authenticateJWT, getJobById);
router.post('/import', authenticateJWT, importJobUrl);
router.post('/discover', authenticateJWT, triggerDiscovery);

export default router;
