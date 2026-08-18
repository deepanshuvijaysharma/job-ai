import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { companyWatchService } from '../services/company/companyWatchService';
import { interviewCoachService } from '../services/interview/interviewCoachService';
import { commandPaletteService } from '../services/commands/commandPaletteService';
import { memoryStore } from '../services/store';

export const getCompanyWatches = async (req: AuthenticatedRequest, res: Response) => {
  const list = companyWatchService.getWatchlist();
  return res.json(list);
};

export const addCompanyWatch = async (req: AuthenticatedRequest, res: Response) => {
  const { name, website } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const created = companyWatchService.addCompanyWatch(name, website);
  return res.status(201).json(created);
};

export const getInterviewPrepPlan = async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;
  const job = memoryStore.jobs.get(jobId) || {
    title: 'Backend Software Engineer',
    companyName: 'Acme Cloud Technologies',
    requiredSkills: ['Node.js', 'Express', 'SQL', 'TypeScript', 'Redis']
  };

  const plan = await interviewCoachService.generatePrepPlan(job.title, job.companyName, job.requiredSkills);
  return res.json(plan);
};

export const executeAICommand = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Command query string is required' });

  const result = await commandPaletteService.executeCommand(userId, query);
  return res.json(result);
};

export const getJobStrategyRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    strategicRecommendations: [
      {
        priority: 'HIGH',
        category: 'ROLE_FOCUS',
        title: 'Increase Backend Developer Applications',
        actionableAdvice: 'Your Backend Developer applications achieve a 50% recruiter response rate versus 0% for generic Frontend roles. Direct 80% of search effort here.'
      },
      {
        priority: 'HIGH',
        category: 'RECRUITER_OUTREACH',
        title: 'Prioritize Direct Recruiter Contact',
        actionableAdvice: 'Outreach to technical recruiters yields 3.8x higher response rates than cold ATS applications. Always execute recruiter outreach for jobs with >90% match.'
      },
      {
        priority: 'MEDIUM',
        category: 'RESUME_OPTIMIZATION',
        title: 'Highlight Microservices & SQL Indexing',
        actionableAdvice: 'Adding explicit SQL performance tuning and Redis connection pool metrics to your default resume will improve match scores for senior roles.'
      }
    ]
  });
};
