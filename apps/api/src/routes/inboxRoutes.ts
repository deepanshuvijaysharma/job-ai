import { Router } from 'express';
import { 
  confirmProposal, 
  getMessages, 
  getPendingProposals, 
  processEmail, 
  rejectProposal, 
  syncInbox 
} from '../controllers/inboxController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.post('/sync', authenticateJWT, syncInbox);
router.get('/messages', authenticateJWT, getMessages);
router.post('/process', authenticateJWT, processEmail);
router.get('/proposals', authenticateJWT, getPendingProposals);
router.post('/confirm', authenticateJWT, confirmProposal);
router.post('/proposals/:id/confirm', authenticateJWT, confirmProposal);
router.post('/reject', authenticateJWT, rejectProposal);
router.post('/proposals/:id/reject', authenticateJWT, rejectProposal);

export default router;
