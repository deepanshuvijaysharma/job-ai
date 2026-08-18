import { Router } from 'express';
import { 
  getAnalyticsDashboard, 
  getDailySummary, 
  getMorningDashboard, 
  getStrategyInsights, 
  getWeeklyReport 
} from '../controllers/analyticsController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/daily-summary', authenticateJWT, getDailySummary);
router.get('/dashboard', authenticateJWT, getAnalyticsDashboard);
router.get('/morning', authenticateJWT, getMorningDashboard);
router.get('/strategy', authenticateJWT, getStrategyInsights);
router.get('/weekly', authenticateJWT, getWeeklyReport);

export default router;
