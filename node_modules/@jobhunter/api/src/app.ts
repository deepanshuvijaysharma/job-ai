import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import outreachRoutes from './routes/outreachRoutes';
import featureRoutes from './routes/featureRoutes';
import emailRoutes from './routes/emailRoutes';
import inboxRoutes from './routes/inboxRoutes';

import { getCORSOrigins } from './config/securityConfig';

dotenv.config();

export const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = getCORSOrigins();
    if (!origin) {
      if (process.env.NODE_ENV === 'production' && allowed.length === 0) {
        return callback(null, false);
      }
      return callback(null, true);
    }
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

import { userRepository } from './repositories/prismaRepository';

// Health & Readiness Check
app.get('/api/health', async (req, res) => {
  let dbConnected = true;
  let dbError: string | undefined;

  if (process.env.DATABASE_URL) {
    try {
      await userRepository.checkDatabaseConnection();
      dbConnected = userRepository.isAvailable();
      if (!dbConnected) {
        dbError = 'PostgreSQL database connection unavailable';
      }
    } catch (err) {
      dbConnected = false;
      dbError = (err as Error).message;
    }
  }

  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL && !dbConnected) {
    return res.status(503).json({
      status: 'error',
      service: 'JobHunter AI Engine API',
      timestamp: new Date().toISOString(),
      dbConnected: false,
      error: dbError || 'Database readiness check failed'
    });
  }

  return res.json({
    status: 'ok',
    service: 'JobHunter AI Engine API',
    timestamp: new Date().toISOString(),
    dbConnected
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/inbox', inboxRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Execution Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});
