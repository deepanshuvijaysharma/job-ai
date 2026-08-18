import { Router } from 'express';
import { confirmProposal, getPendingProposals, processEmail } from '../controllers/inboxController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.post('/process', authenticateJWT, processEmail);
router.get('/proposals', authenticateJWT, getPendingProposals);
router.post('/confirm', authenticateJWT, confirmProposal);

export default router;
