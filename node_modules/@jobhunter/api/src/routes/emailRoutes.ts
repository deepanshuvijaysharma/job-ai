import { Router } from 'express';
import { 
  dispatchApprovedEmail, 
  getConnectedAccounts, 
  getGmailAuthUrl, 
  getOutlookAuthUrl, 
  handleOAuthCallback, 
  sendTestEmail 
} from '../controllers/emailController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/oauth/gmail/url', authenticateJWT, getGmailAuthUrl);
router.get('/oauth/outlook/url', authenticateJWT, getOutlookAuthUrl);
router.get('/oauth/:provider/callback', authenticateJWT, handleOAuthCallback);
router.get('/accounts', authenticateJWT, getConnectedAccounts);
router.post('/test', authenticateJWT, sendTestEmail);
router.post('/dispatch', authenticateJWT, dispatchApprovedEmail);

export default router;
