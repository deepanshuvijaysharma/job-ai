import { Router } from 'express';
import { getProfile, getResumes, updateProfile, uploadResume } from '../controllers/profileController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateJWT, getProfile);
router.put('/', authenticateJWT, updateProfile);
router.get('/resumes', authenticateJWT, getResumes);
router.post('/resumes/upload', authenticateJWT, uploadResume);

export default router;
