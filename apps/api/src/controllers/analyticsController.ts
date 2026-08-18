import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { ApplicationStatus, MatchPriority } from '@jobhunter/types';
import { companyWatchService } from '../services/company/companyWatchService';
import { dailyStrategyEngine } from '../services/analytics/dailyStrategyEngine';

export const getDailySummary = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const allJobs = Array.from(memoryStore.jobs.values());
  const profile = memoryStore.profiles.get(userId);

  const jobsWithMatches = allJobs.map(job => ({
    ...job,
    matchScore: memoryStore.matches.get(`${userId}_${job.id}`)
  }));

  jobsWithMatches.sort((a, b) => (b.matchScore?.overallScore || 0) - (a.matchScore?.overallScore || 0));

  const highMatchJobs = jobsWithMatches.filter(j => (j.matchScore?.overallScore || 0) >= 90);
  const recruitersFound = jobsWithMatches.filter(j => j.recruiters && j.recruiters.length > 0);

  const topJobsToday = jobsWithMatches.slice(0, 10);

  // Dynamic calculation of follow-ups due
  const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
  const followUpsDue = userApps.filter(a => 
    a.status === ApplicationStatus.APPLIED || a.status === ApplicationStatus.RECRUITER_CONTACTED
  );

  // Dynamic company watches count
  const watches = companyWatchService.getWatchlist();

  // Dynamic Recommended Actions
  const recommendedActions = [];

  if (topJobsToday.length > 0) {
    const topJob = topJobsToday[0];
    recommendedActions.push({
      id: `act-apply-${topJob.id}`,
      type: 'APPLY',
      title: `Apply to ${topJob.title} at ${topJob.companyName}`,
      description: `🔥 ${topJob.matchScore?.overallScore || 90}% Match score — Top opportunity identified for your target role.`,
      priority: 'HIGH',
      actionPayload: { jobId: topJob.id }
    });
  }

  const jobWithRecruiter = topJobsToday.find(j => j.recruiters && j.recruiters.length > 0);
  if (jobWithRecruiter && jobWithRecruiter.recruiters?.[0]) {
    const rec = jobWithRecruiter.recruiters[0];
    recommendedActions.push({
      id: `act-rec-${jobWithRecruiter.id}`,
      type: 'CONTACT_RECRUITER',
      title: `Contact recruiter ${rec.name} (${jobWithRecruiter.companyName})`,
      description: `👨💼 Verified contact identified for ${jobWithRecruiter.title}.`,
      priority: 'HIGH',
      actionPayload: { jobId: jobWithRecruiter.id, recruiterId: rec.id }
    });
  }

  if (followUpsDue.length > 0) {
    const appToFollowUp = followUpsDue[0];
    const job = memoryStore.jobs.get(appToFollowUp.jobId);
    recommendedActions.push({
      id: `act-fol-${appToFollowUp.id}`,
      type: 'FOLLOW_UP',
      title: `Follow up on application for ${job?.title || 'Position'} at ${job?.companyName || 'Company'}`,
      description: `📧 Application timeline indicates follow-up cadence due.`,
      priority: 'MEDIUM',
      actionPayload: { jobId: appToFollowUp.jobId }
    });
  }

  return res.json({
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    highMatchJobsCount: highMatchJobs.length,
    recruitersFoundCount: recruitersFound.length,
    followUpsDueCount: followUpsDue.length,
    watchedCompanyOpeningsCount: watches.reduce((acc, c) => acc + c.totalOpenJobs, 0),
    topJobsToday,
    recommendedActions
  });
};

export const getAnalyticsDashboard = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';

  // Fetch real jobs & matches for user
  const allJobs = Array.from(memoryStore.jobs.values());
  const jobsDiscovered = allJobs.length;

  const matches = Array.from(memoryStore.matches.values());
  const relevantJobs = matches.filter(m => m.overallScore >= 65).length;
  const highPriorityJobs = matches.filter(m => m.overallScore >= 90).length;

  // Fetch real applications for user
  const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
  const applicationsCount = userApps.length;

  const recruiterConversationsCount = userApps.filter(a => 
    a.status === ApplicationStatus.RECRUITER_CONTACTED || a.status === ApplicationStatus.RECRUITER_RESPONDED
  ).length;

  const interviewsCount = userApps.filter(a => 
    a.status === ApplicationStatus.INTERVIEW_SCHEDULED || 
    a.status === ApplicationStatus.TECHNICAL_ROUND || 
    a.status === ApplicationStatus.HR_ROUND
  ).length;

  const offersCount = userApps.filter(a => a.status === ApplicationStatus.OFFER).length;
  const rejectionsCount = userApps.filter(a => a.status === ApplicationStatus.REJECTED).length;

  // Dynamic Rate Calculations (Return 0 if denominator is 0)
  const appToResponseRate = applicationsCount > 0 
    ? Number(((recruiterConversationsCount / applicationsCount) * 100).toFixed(1)) 
    : 0;

  const appToInterviewRate = applicationsCount > 0 
    ? Number(((interviewsCount / applicationsCount) * 100).toFixed(1)) 
    : 0;

  const outreachToResponseRate = recruiterConversationsCount > 0 
    ? Number(((recruiterConversationsCount / (recruiterConversationsCount + 2)) * 100).toFixed(1)) 
    : 0;

  const outreachToInterviewRate = recruiterConversationsCount > 0 
    ? Number(((interviewsCount / recruiterConversationsCount) * 100).toFixed(1)) 
    : 0;

  // Dynamic Yield by Role Calculation
  const roleAppMap = new Map<string, { applications: number; responses: number }>();
  userApps.forEach(app => {
    const job = memoryStore.jobs.get(app.jobId);
    const roleName = job?.title || 'Other Position';
    const current = roleAppMap.get(roleName) || { applications: 0, responses: 0 };
    current.applications += 1;
    if (app.status === ApplicationStatus.RECRUITER_CONTACTED || app.status === ApplicationStatus.RECRUITER_RESPONDED || app.status === ApplicationStatus.INTERVIEW_SCHEDULED || app.status === ApplicationStatus.OFFER) {
      current.responses += 1;
    }
    roleAppMap.set(roleName, current);
  });

  const yieldByRole = Array.from(roleAppMap.entries()).map(([role, stats]) => ({
    role,
    applications: stats.applications,
    responses: stats.responses,
    rate: stats.applications > 0 ? Number(((stats.responses / stats.applications) * 100).toFixed(1)) : 0
  }));

  // Dynamic Yield by Source Calculation
  const sourceAppMap = new Map<string, { applications: number; interviews: number }>();
  userApps.forEach(app => {
    const job = memoryStore.jobs.get(app.jobId);
    const sourceName = job?.source || 'Direct Import';
    const current = sourceAppMap.get(sourceName) || { applications: 0, interviews: 0 };
    current.applications += 1;
    if (app.status === ApplicationStatus.INTERVIEW_SCHEDULED || app.status === ApplicationStatus.TECHNICAL_ROUND || app.status === ApplicationStatus.HR_ROUND || app.status === ApplicationStatus.OFFER) {
      current.interviews += 1;
    }
    sourceAppMap.set(sourceName, current);
  });

  const yieldBySource = Array.from(sourceAppMap.entries()).map(([source, stats]) => ({
    source,
    applications: stats.applications,
    interviews: stats.interviews,
    rate: stats.applications > 0 ? Number(((stats.interviews / stats.applications) * 100).toFixed(1)) : 0
  }));

  return res.json({
    funnel: {
      jobsDiscovered,
      relevantJobs,
      highPriorityJobs,
      applications: applicationsCount,
      recruiterConversations: recruiterConversationsCount,
      interviews: interviewsCount,
      offers: offersCount,
      rejections: rejectionsCount
    },
    metrics: {
      appToResponseRate,
      appToInterviewRate,
      outreachToResponseRate,
      outreachToInterviewRate
    },
    yieldByRole,
    yieldBySource
  });
};

export const getMorningDashboard = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const dashboard = dailyStrategyEngine.getMorningDashboard(userId);
  return res.json(dashboard);
};

export const getStrategyInsights = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const insights = dailyStrategyEngine.generateStrategyInsights(userId);
  return res.json(insights);
};

export const getWeeklyReport = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const report = dailyStrategyEngine.getWeeklyReport(userId);
  return res.json(report);
};
