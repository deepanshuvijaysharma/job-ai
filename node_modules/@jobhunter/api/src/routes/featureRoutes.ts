import { Router } from 'express';
import { addCompanyWatch, executeAICommand, getCompanyWatches, getInterviewPrepPlan, getJobStrategyRecommendations } from '../controllers/featureController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/companies', authenticateJWT, getCompanyWatches);
router.post('/companies', authenticateJWT, addCompanyWatch);
router.get('/interview/prep/:jobId', authenticateJWT, getInterviewPrepPlan);
router.post('/command', authenticateJWT, executeAICommand);
router.get('/strategy', authenticateJWT, getJobStrategyRecommendations);

export default router;
