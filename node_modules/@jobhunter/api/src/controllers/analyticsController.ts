import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { ApplicationStatus } from '@jobhunter/types';
import { dailyStrategyEngine } from '../services/analytics/dailyStrategyEngine';
import { queuedEmailsMap } from './outreachController';
import { candidateProfileRepository } from '../repositories/prismaRepository';

export const getDailySummary = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const dashboard = await dailyStrategyEngine.getMorningDashboard(userId);
  return res.json({
    greeting: dashboard.greeting,
    date: dashboard.todayDate,
    highMatchJobsCount: dashboard.metrics.highMatchJobsCount,
    recruitersFoundCount: dashboard.metrics.recruitersToContactCount,
    followUpsDueCount: dashboard.metrics.followupsDueCount,
    watchedCompanyOpeningsCount: dashboard.metrics.newCompanyOpeningsCount,
    topJobsToday: dashboard.topJobsToday,
    recommendedActions: dashboard.priorityActions,
    limits: dashboard.limits
  });
};

export const getAnalyticsDashboard = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';

  // 1. Jobs Discovered & Priority Breakdown
  const allJobs = Array.from(memoryStore.jobs.values());
  const jobsDiscovered = allJobs.length;

  const matches = Array.from(memoryStore.matches.values());
  const relevantJobs = matches.filter(m => m.overallScore >= 65).length;
  const highPriorityJobs = matches.filter(m => m.overallScore >= 90).length;

  // 2. Fetch real applications for user
  const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
  const applicationsCount = userApps.length;

  // 3. Outreach Dispatched & Responses
  const approvedOutreach = Array.from(queuedEmailsMap.values()).filter(
    m => m.userId === userId && m.isApproved
  );
  const recruiterOutreachSent = approvedOutreach.length;

  const recruiterConversationsCount = userApps.filter(a => 
    a.status === ApplicationStatus.RECRUITER_RESPONDED ||
    a.status === ApplicationStatus.INTERVIEW_SCHEDULED ||
    a.status === ApplicationStatus.TECHNICAL_ROUND ||
    a.status === ApplicationStatus.HR_ROUND ||
    a.status === ApplicationStatus.OFFER
  ).length;

  const interviewsCount = userApps.filter(a => 
    a.status === ApplicationStatus.INTERVIEW_SCHEDULED || 
    a.status === ApplicationStatus.TECHNICAL_ROUND || 
    a.status === ApplicationStatus.HR_ROUND
  ).length;

  const offersCount = userApps.filter(a => a.status === ApplicationStatus.OFFER).length;
  const rejectionsCount = userApps.filter(a => a.status === ApplicationStatus.REJECTED).length;

  // 4. Exact Data-Driven Formulas
  const appToResponseRate = applicationsCount > 0 
    ? Number(((recruiterConversationsCount / applicationsCount) * 100).toFixed(1)) 
    : 0;

  const appToInterviewRate = applicationsCount > 0 
    ? Number(((interviewsCount / applicationsCount) * 100).toFixed(1)) 
    : 0;

  const outreachToResponseRate = recruiterOutreachSent > 0 
    ? Number(((recruiterConversationsCount / recruiterOutreachSent) * 100).toFixed(1)) 
    : 0;

  const outreachToInterviewRate = recruiterOutreachSent > 0 
    ? Number(((interviewsCount / recruiterOutreachSent) * 100).toFixed(1)) 
    : 0;

  const offerRate = applicationsCount > 0 
    ? Number(((offersCount / applicationsCount) * 100).toFixed(1)) 
    : 0;

  // 5. Dynamic Breakdown Calculations with Sample-Size Protection
  const yieldByRole = await dailyStrategyEngine.getRolePerformance(userId);
  const yieldBySource = await dailyStrategyEngine.getSourcePerformance(userId);
  const yieldByResume = await dailyStrategyEngine.getResumePerformance(userId);

  return res.json({
    funnel: {
      jobsDiscovered,
      relevantJobs,
      highPriorityJobs,
      applications: applicationsCount,
      recruiterOutreachSent,
      recruiterConversations: recruiterConversationsCount,
      interviews: interviewsCount,
      offers: offersCount,
      rejections: rejectionsCount
    },
    metrics: {
      appToResponseRate,
      appToInterviewRate,
      outreachToResponseRate,
      outreachToInterviewRate,
      offerRate
    },
    yieldByRole,
    yieldBySource,
    yieldByResume
  });
};

export const getMorningDashboard = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const dashboard = await dailyStrategyEngine.getMorningDashboard(userId);
  return res.json(dashboard);
};

export const getStrategyInsights = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const insights = await dailyStrategyEngine.generateStrategyInsights(userId);
  return res.json(insights);
};

export const getWeeklyReport = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const report = await dailyStrategyEngine.getWeeklyReport(userId);
  return res.json(report);
};

export const updateDailyQuotas = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { dailyAppTarget, dailyOutreachTarget, dailyFollowUpTarget } = req.body;

  try {
    const updated = await candidateProfileRepository.upsert(userId, {
      dailyAppTarget: Number(dailyAppTarget) || 15,
      dailyOutreachTarget: Number(dailyOutreachTarget) || 10,
      dailyFollowUpTarget: Number(dailyFollowUpTarget) || 5
    } as any);

    return res.json({
      message: 'Daily quotas updated successfully in PostgreSQL profile',
      quotas: {
        dailyAppTarget: (updated as any).dailyAppTarget || 15,
        dailyOutreachTarget: (updated as any).dailyOutreachTarget || 10,
        dailyFollowUpTarget: (updated as any).dailyFollowUpTarget || 5
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update daily quotas' });
  }
};
