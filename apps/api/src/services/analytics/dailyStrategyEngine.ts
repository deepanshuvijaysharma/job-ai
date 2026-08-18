import { memoryStore } from '../store';
import { followUpEngineService } from '../outreach/followUpEngine';
import { queuedEmailsMap } from '../../controllers/outreachController';
import { 
  ApplicationStatus, 
  PriorityActionItemDTO, 
  Step10MorningDashboardDTO, 
  TopJobItemDTO, 
  FollowUpActionItemDTO 
} from '@jobhunter/types';
import { applicationRepository, candidateProfileRepository, inboxRepository } from '../../repositories/prismaRepository';

export type ConfidenceTier = 'INSUFFICIENT_DATA' | 'EARLY_SIGNAL' | 'USABLE_SIGNAL';

export function getConfidenceTier(sampleSize: number): ConfidenceTier {
  if (sampleSize >= 10) return 'USABLE_SIGNAL';
  if (sampleSize >= 5) return 'EARLY_SIGNAL';
  return 'INSUFFICIENT_DATA';
}

export interface StrategyInsight {
  type: 'ROLE' | 'OUTREACH' | 'RESUME' | 'SOURCE';
  title: string;
  description: string;
  confidence: ConfidenceTier;
  sampleSize: number;
}

export interface GroupPerformanceStats {
  category: string;
  applications: number;
  responses: number;
  interviews: number;
  responseRate: number;
  interviewRate: number;
  confidence: ConfidenceTier;
}

export class DailyStrategyEngine {
  /**
   * Compute Morning Dashboard Overview & Daily Priority Actions from PostgreSQL Records
   */
  public async getMorningDashboard(userId: string): Promise<Step10MorningDashboardDTO> {
    const todayStr = new Date().toISOString().split('T')[0];

    // Load PostgreSQL Application Records
    const dbApps = await applicationRepository.findByUserId(userId);
    const userApps = dbApps || [];

    // Load User Candidate Profile for Quotas
    const profile = await candidateProfileRepository.findByUserId(userId);
    const appLimit = (profile as any)?.dailyAppTarget || 15;
    const outreachLimit = (profile as any)?.dailyOutreachTarget || 10;
    const followUpLimit = (profile as any)?.dailyFollowUpTarget || 5;

    // 1. High match jobs
    const jobsList = Array.from(memoryStore.jobs.values());
    const highMatchJobs = jobsList.filter(j => {
      const match = memoryStore.matches.get(`${userId}_${j.id}`);
      return match && match.overallScore >= 85;
    });

    // 2. Recruiters to contact & pending outreach drafts
    const pendingOutreach = Array.from(queuedEmailsMap.values()).filter(
      m => m.userId === userId && !m.isApproved
    );

    // 3. Verified recruiters count
    const recruitersMap = (memoryStore as any).recruiters || new Map();
    const verifiedRecruiterCount = Array.from(recruitersMap.values()).filter((r: any) => r && r.isVerified).length;

    // 4. Follow-ups due
    const followupsDue = await followUpEngineService.getDueFollowUps(userId);

    // 5. Upcoming interviews & proposals
    const upcomingInterviews = userApps.filter(a => 
      a.status === ApplicationStatus.INTERVIEW_SCHEDULED || 
      a.status === ApplicationStatus.TECHNICAL_ROUND || 
      a.status === ApplicationStatus.HR_ROUND
    );

    const pendingProposals = await inboxRepository.findProposalsByUserId(userId, false);

    // 6. Transparent Priority Action Engine (8 Action Types)
    const priorityActions: PriorityActionItemDTO[] = [];

    // Action 1: PREPARE_INTERVIEW (Upcoming Interviews)
    upcomingInterviews.forEach((a, i) => {
      priorityActions.push({
        id: `act-int-prep-${a.id}`,
        type: 'PREPARE_INTERVIEW',
        title: `Prepare for ${(a as any).jobTitle || a.job?.title || 'Technical'} Interview`,
        companyName: (a as any).companyName || a.job?.companyName || 'Target Company',
        jobTitle: (a as any).jobTitle || a.job?.title || 'Engineer',
        priorityScore: 99 - i,
        urgency: 'HIGH',
        reason: 'Upcoming scheduled interview requires preparation',
        requiredUserAction: 'Review question bank and mock prep',
        targetId: a.id
      });
    });

    // Action 2: CONFIRM_INTERVIEW / REVIEW_RECRUITER_REPLY (Pending Inbox Proposals)
    pendingProposals.forEach((p, i) => {
      const isInterview = p.emailCategory === 'INTERVIEW_INVITATION';
      priorityActions.push({
        id: `act-prop-${p.id}`,
        type: isInterview ? 'CONFIRM_INTERVIEW' : 'REVIEW_RECRUITER_REPLY',
        title: isInterview ? `Confirm Interview with ${p.companyName}` : `Review Recruiter Response from ${p.companyName}`,
        companyName: p.companyName,
        jobTitle: p.jobTitle,
        priorityScore: 96 - i,
        urgency: 'HIGH',
        reason: `Recruiter message detected: proposed status ${p.proposedStatus}`,
        requiredUserAction: 'Confirm proposal to update pipeline and cancel follow-ups',
        targetId: p.id
      });
    });

    // Action 3: FOLLOW_UP (Follow-ups Due Today)
    followupsDue.forEach((f, i) => {
      priorityActions.push({
        id: `act-fol-due-${f.id}`,
        type: 'FOLLOW_UP',
        title: `Send Follow-up to ${f.companyName} (${f.recruiterName || 'Recruiter'})`,
        companyName: f.companyName,
        priorityScore: 90 - i,
        urgency: 'HIGH',
        reason: `Day ${f.scheduledForDays} follow-up scheduled for application`,
        requiredUserAction: 'Approve drafted follow-up email',
        targetId: f.id
      });
    });

    // Action 4: CONTACT_RECRUITER (Approved/Draft Outreach)
    pendingOutreach.forEach((m, i) => {
      priorityActions.push({
        id: `act-outreach-${m.id}`,
        type: 'CONTACT_RECRUITER',
        title: `Send Outreach to ${m.recruiterName || 'Recruiter'} at ${m.companyName}`,
        companyName: m.companyName,
        jobTitle: m.jobTitle,
        priorityScore: 85 - i,
        urgency: 'MEDIUM',
        reason: 'Personalized recruiter message generated and awaiting send approval',
        requiredUserAction: 'Approve email send queue',
        targetId: m.id
      });
    });

    // Action 5: APPLY_JOB (High-Match Fresh Jobs)
    highMatchJobs.slice(0, 4).forEach((j, i) => {
      const match = memoryStore.matches.get(`${userId}_${j.id}`);
      const score = match?.overallScore || 90;
      priorityActions.push({
        id: `act-apply-job-${j.id}`,
        type: 'APPLY_JOB',
        title: `Apply for ${j.title} at ${j.companyName}`,
        companyName: j.companyName,
        jobTitle: j.title,
        matchScore: score,
        priorityScore: Math.round(0.4 * score + 0.3 * 80 + 0.2 * 90 + 0.1 * 85),
        urgency: 'MEDIUM',
        reason: `High fit match (${score}%) posted recently`,
        freshness: 'Posted today',
        requiredUserAction: 'Submit application via automated portal',
        targetId: j.id
      });
    });

    // Sort priority actions by priority score descending
    priorityActions.sort((a, b) => b.priorityScore - a.priorityScore);

    // Compute Daily Usage Counters from Real PostgreSQL / Store Records
    const applicationsToday = userApps.filter(a => {
      const dateStr = a.createdAt || (a as any).appliedAt;
      return dateStr && new Date(dateStr).toISOString().startsWith(todayStr);
    }).length;

    const recruiterEmailsToday = Array.from(queuedEmailsMap.values()).filter(
      m => m.userId === userId && m.isApproved && m.approvedAt?.startsWith(todayStr)
    ).length;

    const followupsToday = followupsDue.filter(f => f.status === 'SENT').length;

    // Top Jobs Today
    const topJobsToday: TopJobItemDTO[] = highMatchJobs.slice(0, 5).map(j => {
      const match = memoryStore.matches.get(`${userId}_${j.id}`);
      return {
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        matchScore: match?.overallScore || 92,
        postedAgo: 'Posted 2 hours ago',
        recruiterVerified: true,
        urgency: 'HIGH',
        location: j.location || 'Remote'
      };
    });

    // Follow-ups Due Today List
    const followupsDueToday: FollowUpActionItemDTO[] = followupsDue.map(f => ({
      id: f.id,
      applicationId: f.applicationId,
      companyName: f.companyName,
      recruiterName: f.recruiterName,
      scheduledForDays: f.scheduledForDays,
      dueDate: f.scheduledAt || new Date().toISOString(),
      urgency: 'HIGH',
      status: f.status
    }));

    return {
      greeting: 'GOOD MORNING 👋',
      todayDate: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
      limits: {
        applicationsToday,
        applicationsLimit: appLimit,
        recruiterEmailsToday,
        recruiterEmailsLimit: outreachLimit,
        followupsToday,
        followupsLimit: followUpLimit
      },
      metrics: {
        highMatchJobsCount: highMatchJobs.length,
        recruitersToContactCount: pendingOutreach.length,
        followupsDueCount: followupsDue.length,
        newCompanyOpeningsCount: jobsList.length,
        upcomingInterviewsCount: upcomingInterviews.length,
        verifiedRecruitersCount: verifiedRecruiterCount
      },
      priorityActions,
      topJobsToday,
      followupsDueToday
    };
  }

  /**
   * Performance breakdown by Normalized Job Role with Zero-Fabrication Protection
   */
  public async getRolePerformance(userId: string): Promise<GroupPerformanceStats[]> {
    const dbApps = await applicationRepository.findByUserId(userId);
    const userApps = dbApps || [];
    const map = new Map<string, { applications: number; responses: number; interviews: number }>();

    userApps.forEach(app => {
      const job = memoryStore.jobs.get(app.jobId);
      const rawTitle = (app as any).jobTitle || job?.title || 'Unclassified Role';
      
      let roleCat = 'Software Engineer';
      const titleLower = rawTitle.toLowerCase();
      if (titleLower.includes('backend') || titleLower.includes('node')) roleCat = 'Backend Developer';
      else if (titleLower.includes('full stack') || titleLower.includes('fullstack') || titleLower.includes('mern')) roleCat = 'Full Stack Developer';
      else if (titleLower.includes('frontend') || titleLower.includes('react')) roleCat = 'Frontend Developer';
      else if (titleLower.includes('ai') || titleLower.includes('machine learning') || titleLower.includes('genai')) roleCat = 'AI/GenAI Engineer';
      else if (titleLower.includes('support') || titleLower.includes('qa') || titleLower.includes('test')) roleCat = 'Support / QA Engineer';

      const stats = map.get(roleCat) || { applications: 0, responses: 0, interviews: 0 };
      stats.applications += 1;

      if ([
        ApplicationStatus.RECRUITER_RESPONDED, 
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.responses += 1;
      }

      if ([
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.interviews += 1;
      }

      map.set(roleCat, stats);
    });

    return Array.from(map.entries()).map(([category, stats]) => ({
      category,
      applications: stats.applications,
      responses: stats.responses,
      interviews: stats.interviews,
      responseRate: stats.applications > 0 ? Number(((stats.responses / stats.applications) * 100).toFixed(1)) : 0,
      interviewRate: stats.applications > 0 ? Number(((stats.interviews / stats.applications) * 100).toFixed(1)) : 0,
      confidence: getConfidenceTier(stats.applications)
    }));
  }

  /**
   * Performance breakdown by Actual Job Source
   */
  public async getSourcePerformance(userId: string): Promise<GroupPerformanceStats[]> {
    const dbApps = await applicationRepository.findByUserId(userId);
    const userApps = dbApps || [];
    const map = new Map<string, { applications: number; responses: number; interviews: number }>();

    userApps.forEach(app => {
      const job = memoryStore.jobs.get(app.jobId);
      const source = job?.source || 'User Import';

      const stats = map.get(source) || { applications: 0, responses: 0, interviews: 0 };
      stats.applications += 1;

      if ([
        ApplicationStatus.RECRUITER_RESPONDED, 
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.responses += 1;
      }

      if ([
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.interviews += 1;
      }

      map.set(source, stats);
    });

    return Array.from(map.entries()).map(([category, stats]) => ({
      category,
      applications: stats.applications,
      responses: stats.responses,
      interviews: stats.interviews,
      responseRate: stats.applications > 0 ? Number(((stats.responses / stats.applications) * 100).toFixed(1)) : 0,
      interviewRate: stats.applications > 0 ? Number(((stats.interviews / stats.applications) * 100).toFixed(1)) : 0,
      confidence: getConfidenceTier(stats.applications)
    }));
  }

  /**
   * Performance breakdown by Resume Version Used
   */
  public async getResumePerformance(userId: string): Promise<GroupPerformanceStats[]> {
    const dbApps = await applicationRepository.findByUserId(userId);
    const userApps = dbApps || [];
    const map = new Map<string, { applications: number; responses: number; interviews: number }>();

    userApps.forEach(app => {
      const match = memoryStore.matches.get(`${userId}_${app.jobId}`);
      const resumeTitle = match?.recommendedResumeTitle || 'Default Resume';

      const stats = map.get(resumeTitle) || { applications: 0, responses: 0, interviews: 0 };
      stats.applications += 1;

      if ([
        ApplicationStatus.RECRUITER_RESPONDED, 
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.responses += 1;
      }

      if ([
        ApplicationStatus.INTERVIEW_SCHEDULED, 
        ApplicationStatus.TECHNICAL_ROUND, 
        ApplicationStatus.HR_ROUND, 
        ApplicationStatus.OFFER
      ].includes(app.status)) {
        stats.interviews += 1;
      }

      map.set(resumeTitle, stats);
    });

    return Array.from(map.entries()).map(([category, stats]) => ({
      category,
      applications: stats.applications,
      responses: stats.responses,
      interviews: stats.interviews,
      responseRate: stats.applications > 0 ? Number(((stats.responses / stats.applications) * 100).toFixed(1)) : 0,
      interviewRate: stats.applications > 0 ? Number(((stats.interviews / stats.applications) * 100).toFixed(1)) : 0,
      confidence: getConfidenceTier(stats.applications)
    }));
  }

  /**
   * Generate Data-Driven Strategy Recommendations strictly from database records
   */
  public async generateStrategyInsights(userId: string): Promise<StrategyInsight[]> {
    const roleStats = await this.getRolePerformance(userId);
    const sourceStats = await this.getSourcePerformance(userId);
    const resumeStats = await this.getResumePerformance(userId);

    const insights: StrategyInsight[] = [];

    // Role insight (sample size >= 5 required)
    const validRoles = roleStats.filter(r => r.applications >= 5);
    if (validRoles.length > 0) {
      validRoles.sort((a, b) => b.responseRate - a.responseRate);
      const topRole = validRoles[0];
      insights.push({
        type: 'ROLE',
        title: `${topRole.category} Roles Outperforming`,
        description: `${topRole.category} roles currently achieve your highest response rate (${topRole.responseRate}% response rate across ${topRole.applications} applications).`,
        confidence: topRole.confidence,
        sampleSize: topRole.applications
      });
    } else {
      insights.push({
        type: 'ROLE',
        title: 'Insufficient Role Data',
        description: 'Insufficient data to determine the best-performing role (minimum 5 applications required per role category).',
        confidence: 'INSUFFICIENT_DATA',
        sampleSize: roleStats.reduce((acc, r) => acc + r.applications, 0)
      });
    }

    // Source insight (sample size >= 5 required)
    const validSources = sourceStats.filter(s => s.applications >= 5);
    if (validSources.length > 0) {
      validSources.sort((a, b) => b.interviewRate - a.interviewRate);
      const topSource = validSources[0];
      insights.push({
        type: 'SOURCE',
        title: `${topSource.category} Highest Interview Yield`,
        description: `${topSource.category} produces your highest interview conversion rate (${topSource.interviewRate}% interview rate across ${topSource.applications} applications).`,
        confidence: topSource.confidence,
        sampleSize: topSource.applications
      });
    }

    // Resume version insight (sample size >= 5 required)
    const validResumes = resumeStats.filter(r => r.applications >= 5);
    if (validResumes.length > 0) {
      validResumes.sort((a, b) => b.responseRate - a.responseRate);
      const topResume = validResumes[0];
      insights.push({
        type: 'RESUME',
        title: `${topResume.category} Version Alignment`,
        description: `${topResume.category} generates a ${topResume.responseRate}% response rate across ${topResume.applications} submissions.`,
        confidence: topResume.confidence,
        sampleSize: topResume.applications
      });
    }

    return insights;
  }

  /**
   * Generate Weekly Job Search Intelligence Report from actual records
   */
  public async getWeeklyReport(userId: string) {
    const dbApps = await applicationRepository.findByUserId(userId);
    const userApps = dbApps || [];
    const jobsList = Array.from(memoryStore.jobs.values());
    const approvedOutreach = Array.from(queuedEmailsMap.values()).filter(m => m.userId === userId && m.isApproved);
    
    // Pure Database Counts (Genuine Inbound Responses Only)
    const responsesCount = userApps.filter(a => [
      ApplicationStatus.RECRUITER_RESPONDED,
      ApplicationStatus.INTERVIEW_SCHEDULED,
      ApplicationStatus.TECHNICAL_ROUND,
      ApplicationStatus.HR_ROUND,
      ApplicationStatus.OFFER
    ].includes(a.status) && approvedOutreach.some(o => o.jobId === a.jobId)).length;

    const interviewsCount = userApps.filter(a => [
      ApplicationStatus.INTERVIEW_SCHEDULED,
      ApplicationStatus.TECHNICAL_ROUND,
      ApplicationStatus.HR_ROUND
    ].includes(a.status)).length;

    const offersCount = userApps.filter(a => a.status === ApplicationStatus.OFFER).length;

    // Best Role calculation
    const roleStats = (await this.getRolePerformance(userId)).filter(r => r.applications >= 5);
    roleStats.sort((a, b) => b.responseRate - a.responseRate);
    const bestRoleStr = roleStats.length > 0 
      ? `${roleStats[0].category} (${roleStats[0].responseRate}% response rate)` 
      : 'insufficient_data';

    // Best Source calculation
    const sourceStats = (await this.getSourcePerformance(userId)).filter(s => s.applications >= 5);
    sourceStats.sort((a, b) => b.interviewRate - a.interviewRate);
    const bestSourceStr = sourceStats.length > 0 
      ? `${sourceStats[0].category} (${sourceStats[0].interviewRate}% interview rate)` 
      : 'insufficient_data';

    // Best Resume calculation
    const resumeStats = (await this.getResumePerformance(userId)).filter(r => r.applications >= 5);
    resumeStats.sort((a, b) => b.responseRate - a.responseRate);
    const bestResumeStr = resumeStats.length > 0 
      ? `${resumeStats[0].category} (${resumeStats[0].responseRate}% response rate)` 
      : 'insufficient_data';

    const companyTypeStr = 'insufficient_data';

    return {
      period: 'Weekly Job Search Summary',
      generatedAt: new Date().toISOString(),
      summaryMetrics: {
        jobsDiscovered: jobsList.length,
        applications: userApps.length,
        recruiterContacts: approvedOutreach.length,
        responses: responsesCount,
        interviews: interviewsCount,
        offers: offersCount
      },
      topPerformers: {
        bestRole: bestRoleStr,
        bestSource: bestSourceStr,
        bestResume: bestResumeStr,
        bestCompanyType: companyTypeStr
      },
      recommendationsNextWeek: userApps.length >= 5 ? [
        `Focus applications on categories showing reliable response signals.`,
        `Maintain direct recruiter outreach alongside portal submissions.`
      ] : [
        `Keep collecting job search data before changing your job-search strategy (minimum 5 applications required).`
      ]
    };
  }
}

export const dailyStrategyEngine = new DailyStrategyEngine();
