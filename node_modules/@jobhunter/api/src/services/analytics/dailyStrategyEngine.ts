import { memoryStore } from '../store';
import { followUpEngineService } from '../outreach/followUpEngine';
import { queuedEmailsMap } from '../../controllers/outreachController';
import { ApplicationStatus } from '@jobhunter/types';

export type ConfidenceTier = 'INSUFFICIENT_DATA' | 'EARLY_SIGNAL' | 'USABLE_SIGNAL';

export function getConfidenceTier(sampleSize: number): ConfidenceTier {
  if (sampleSize >= 10) return 'USABLE_SIGNAL';
  if (sampleSize >= 5) return 'EARLY_SIGNAL';
  return 'INSUFFICIENT_DATA';
}

export interface PriorityActionItem {
  id: string;
  type: 'APPLY_JOB' | 'CONTACT_RECRUITER' | 'FOLLOW_UP' | 'PREPARE_INTERVIEW';
  title: string;
  companyName: string;
  matchScore?: number;
  priorityScore: number;
  reason: string;
  targetId: string;
}

export interface DailyDashboardDTO {
  greeting: string;
  todayDate: string;
  limits: {
    applicationsToday: number;
    applicationsLimit: number;
    recruiterEmailsToday: number;
    recruiterEmailsLimit: number;
    followupsToday: number;
    followupsLimit: number;
  };
  metrics: {
    highMatchJobsCount: number;
    recruitersToContactCount: number;
    followupsDueCount: number;
    newCompanyOpeningsCount: number;
    upcomingInterviewsCount: number;
  };
  priorityActions: PriorityActionItem[];
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
   * Compute Morning Dashboard Overview & Daily Priority Actions
   */
  public getMorningDashboard(userId: string): DailyDashboardDTO {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. High match jobs
    const jobsList = Array.from(memoryStore.jobs.values());
    const highMatchJobs = jobsList.filter(j => {
      const match = memoryStore.matches.get(`${userId}_${j.id}`);
      return match && match.overallScore >= 90;
    });

    // 2. Recruiters to contact
    const pendingOutreach = Array.from(queuedEmailsMap.values()).filter(
      m => m.userId === userId && !m.isApproved
    );

    // 3. Follow-ups due
    const followupsDue = followUpEngineService.getDueFollowUps(userId);

    // 4. Upcoming interviews
    const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
    const upcomingInterviews = userApps.filter(a => 
      a.status === ApplicationStatus.INTERVIEW_SCHEDULED || 
      a.status === ApplicationStatus.TECHNICAL_ROUND || 
      a.status === ApplicationStatus.HR_ROUND
    );

    // 5. Build Priority Actions
    const priorityActions: PriorityActionItem[] = [];

    // High match jobs to apply
    highMatchJobs.slice(0, 3).forEach((j, i) => {
      const match = memoryStore.matches.get(`${userId}_${j.id}`);
      priorityActions.push({
        id: `act-apply-${j.id}`,
        type: 'APPLY_JOB',
        title: `Apply to ${j.title}`,
        companyName: j.companyName,
        matchScore: match?.overallScore || 95,
        priorityScore: 98 - i,
        reason: `High fit match (${match?.overallScore || 95}%) with core technical skills`,
        targetId: j.id
      });
    });

    // Recruiter contacts
    pendingOutreach.slice(0, 2).forEach((m, i) => {
      priorityActions.push({
        id: `act-rec-${m.id}`,
        type: 'CONTACT_RECRUITER',
        title: `Contact recruiter (${m.recruiterName}) for ${m.jobTitle}`,
        companyName: m.companyName,
        matchScore: 94,
        priorityScore: 92 - i,
        reason: `Verified recruiter contact identified for high priority role`,
        targetId: m.id
      });
    });

    // Follow-ups due
    followupsDue.slice(0, 2).forEach((f, i) => {
      priorityActions.push({
        id: `act-fol-${f.id}`,
        type: 'FOLLOW_UP',
        title: `Follow up with ${f.companyName} (${f.recruiterName})`,
        companyName: f.companyName,
        priorityScore: 88 - i,
        reason: `Day ${f.scheduledForDays} follow-up due for active application`,
        targetId: f.id
      });
    });

    // Upcoming Interview Preparation
    upcomingInterviews.slice(0, 1).forEach((a, i) => {
      priorityActions.push({
        id: `act-int-${a.id}`,
        type: 'PREPARE_INTERVIEW',
        title: `Prepare for ${a.jobTitle || 'Backend Developer'} interview`,
        companyName: a.companyName || 'Target Company',
        priorityScore: 99,
        reason: `Upcoming interview scheduled — review AI Question Bank`,
        targetId: a.id
      });
    });

    // Sort priority actions by priority score descending
    priorityActions.sort((a, b) => b.priorityScore - a.priorityScore);

    // Compute Daily Quotas
    const applicationsToday = userApps.filter(a => a.createdAt?.startsWith(todayStr)).length;
    const recruiterEmailsToday = Array.from(queuedEmailsMap.values()).filter(
      m => m.userId === userId && m.isApproved && m.approvedAt?.startsWith(todayStr)
    ).length;

    return {
      greeting: 'GOOD MORNING 👋',
      todayDate: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
      limits: {
        applicationsToday,
        applicationsLimit: 15,
        recruiterEmailsToday,
        recruiterEmailsLimit: 10,
        followupsToday: followupsDue.filter(f => f.status === 'SENT').length,
        followupsLimit: 5
      },
      metrics: {
        highMatchJobsCount: highMatchJobs.length,
        recruitersToContactCount: pendingOutreach.length,
        followupsDueCount: followupsDue.length,
        newCompanyOpeningsCount: jobsList.length,
        upcomingInterviewsCount: upcomingInterviews.length
      },
      priorityActions
    };
  }

  /**
   * Performance breakdown by Normalized Job Role
   */
  public getRolePerformance(userId: string): GroupPerformanceStats[] {
    const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
    const map = new Map<string, { applications: number; responses: number; interviews: number }>();

    userApps.forEach(app => {
      const job = memoryStore.jobs.get(app.jobId);
      const rawTitle = job?.title || app.jobTitle || 'Unclassified Role';
      
      // Normalize role category
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
  public getSourcePerformance(userId: string): GroupPerformanceStats[] {
    const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
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
  public getResumePerformance(userId: string): GroupPerformanceStats[] {
    const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
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
  public generateStrategyInsights(userId: string): StrategyInsight[] {
    const roleStats = this.getRolePerformance(userId);
    const sourceStats = this.getSourcePerformance(userId);
    const resumeStats = this.getResumePerformance(userId);

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
  public getWeeklyReport(userId: string) {
    const userApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
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
    const roleStats = this.getRolePerformance(userId).filter(r => r.applications >= 5);
    roleStats.sort((a, b) => b.responseRate - a.responseRate);
    const bestRoleStr = roleStats.length > 0 
      ? `${roleStats[0].category} (${roleStats[0].responseRate}% response rate)` 
      : 'insufficient_data';

    // Best Source calculation
    const sourceStats = this.getSourcePerformance(userId).filter(s => s.applications >= 5);
    sourceStats.sort((a, b) => b.interviewRate - a.interviewRate);
    const bestSourceStr = sourceStats.length > 0 
      ? `${sourceStats[0].category} (${sourceStats[0].interviewRate}% interview rate)` 
      : 'insufficient_data';

    // Best Resume calculation
    const resumeStats = this.getResumePerformance(userId).filter(r => r.applications >= 5);
    resumeStats.sort((a, b) => b.responseRate - a.responseRate);
    const bestResumeStr = resumeStats.length > 0 
      ? `${resumeStats[0].category} (${resumeStats[0].responseRate}% response rate)` 
      : 'insufficient_data';

    // Company type (only if industry metadata exists in database)
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
