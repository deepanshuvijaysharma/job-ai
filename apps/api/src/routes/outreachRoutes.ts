import { Router } from 'express';
import { approveEmails, editEmailDraft, generateEmailDraft, getApprovalQueue, getDueFollowUps, stopFollowUp } from '../controllers/outreachController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/approval-queue', authenticateJWT, getApprovalQueue);
router.post('/generate', authenticateJWT, generateEmailDraft);
router.post('/approve', authenticateJWT, approveEmails);
router.post('/edit', authenticateJWT, editEmailDraft);
router.get('/followups', authenticateJWT, getDueFollowUps);
router.post('/followups/stop', authenticateJWT, stopFollowUp);

export default router;
