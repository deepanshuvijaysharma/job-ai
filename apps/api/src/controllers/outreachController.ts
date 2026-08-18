import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { memoryStore } from '../services/store';
import { emailGeneratorService, OutreachTemplateType } from '../services/outreach/emailGenerator';
import { recruiterService } from '../services/recruiter/recruiterService';
import { followUpEngineService } from '../services/outreach/followUpEngine';

// In-Memory Outreach Approval Queue
interface QueuedEmail {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail?: string;
  recruiterRole: string;
  subject: string;
  body: string;
  templateType: OutreachTemplateType;
  isApproved: boolean;
  approvedAt?: string;
  sentAt?: string;
  aiReasoning: string;
  confidence: number;
  createdAt: string;
}

export const queuedEmailsMap = new Map<string, QueuedEmail>();

export const seedDemoOutreachEmails = () => {
  queuedEmailsMap.set('msg-101', {
    id: 'msg-101',
    userId: 'demo-user-123',
    jobId: 'job-101',
    jobTitle: 'Backend Developer (Node.js & Microservices)',
    companyName: 'Acme Cloud Technologies',
    recruiterId: 'rec-1',
    recruiterName: 'Amit Sharma (Demo)',
    recruiterEmail: 'amit.sharma@acmecloud.com',
    recruiterRole: 'Technical Recruiter - Engineering',
    subject: 'Application & Inquiry: Backend Developer — Deepanshu Sharma',
    body: `Hi Amit,\n\nI noticed that Acme Cloud Technologies is hiring for a Backend Developer position focused on Node.js, Express, and REST APIs.\n\nMy background is aligned with Node.js, Express, REST APIs, TypeScript, and SQL, and I have built production-style microservices platforms around these technologies.\n\nI would be grateful if you could consider my profile for the role.\n\nThanks,\nDeepanshu Sharma`,
    templateType: 'FIRST_CONTACT',
    isApproved: false,
    aiReasoning: 'Direct outreach to primary technical recruiter for 96% match job opening.',
    confidence: 0.94,
    createdAt: new Date().toISOString()
  });
};

if (process.env.SEED_DEMO_DATA === 'true') {
  seedDemoOutreachEmails();
}

export const getApprovalQueue = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const pending = Array.from(queuedEmailsMap.values()).filter(m => m.userId === userId && !m.isApproved);
  const approved = Array.from(queuedEmailsMap.values()).filter(m => m.userId === userId && m.isApproved);

  return res.json({
    pending,
    approvedCount: approved.length,
    dailyLimit: 10,
    dailyRemaining: Math.max(0, 10 - approved.length)
  });
};

export const generateEmailDraft = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { jobId, recruiterId, templateType = 'FIRST_CONTACT' } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const job = memoryStore.jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const profile = memoryStore.profiles.get(userId);
  const candidateData = {
    name: req.user?.email ? 'Deepanshu Sharma' : 'Deepanshu Sharma',
    currentRole: profile?.currentRole || 'Full Stack Engineer',
    skills: profile?.skills.map(s => s.name) || ['Node.js', 'Express', 'React', 'SQL'],
    projects: profile?.projects || []
  };

  // Recruiters discovery/rank
  let targetRecruiter = job.recruiters?.find(r => r.id === recruiterId) || job.recruiters?.[0];
  if (!targetRecruiter) {
    const discovered = await recruiterService.discoverAndRankRecruiters(job);
    targetRecruiter = discovered[0]?.recruiter;
  }

  if (!targetRecruiter) {
    return res.status(404).json({ error: 'No recruiter contact identified for this job' });
  }

  const draft = await emailGeneratorService.generatePersonalizedEmail(
    candidateData,
    { title: job.title, companyName: job.companyName, requiredSkills: job.requiredSkills, location: job.location },
    { name: targetRecruiter.name, role: targetRecruiter.role },
    templateType as OutreachTemplateType
  );

  const queuedId = `msg-${Date.now()}`;
  const queuedEmail: QueuedEmail = {
    id: queuedId,
    userId,
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.companyName,
    recruiterId: targetRecruiter.id,
    recruiterName: targetRecruiter.name,
    recruiterEmail: targetRecruiter.email,
    recruiterRole: targetRecruiter.role,
    subject: draft.subject,
    body: draft.body,
    templateType: draft.templateType,
    isApproved: false,
    aiReasoning: draft.aiReasoning,
    confidence: targetRecruiter.confidence || 0.90,
    createdAt: new Date().toISOString()
  };

  queuedEmailsMap.set(queuedId, queuedEmail);
  return res.status(201).json(queuedEmail);
};

export const approveEmails = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { messageIds } = req.body; // array of message IDs or single ID

  if (!messageIds || (Array.isArray(messageIds) && messageIds.length === 0)) {
    return res.status(400).json({ error: 'messageIds array is required' });
  }

  const idsToApprove = Array.isArray(messageIds) ? messageIds : [messageIds];

  // Daily Rate Limit Enforcement (10 emails/day)
  const todayApprovedCount = Array.from(queuedEmailsMap.values()).filter(
    m => m.userId === userId && m.isApproved && m.approvedAt?.startsWith(new Date().toISOString().split('T')[0])
  ).length;

  if (todayApprovedCount + idsToApprove.length > 10) {
    return res.status(429).json({
      error: `Daily Outreach Limit Reached: Exceeds maximum 10 recruiter emails/day (${todayApprovedCount}/10 sent today).`
    });
  }

  const approvedList: QueuedEmail[] = [];

  for (const id of idsToApprove) {
    const msg = queuedEmailsMap.get(id);
    if (msg && msg.userId === userId) {
      msg.isApproved = true;
      msg.approvedAt = new Date().toISOString();
      msg.sentAt = new Date().toISOString(); // Simulated dispatch
      queuedEmailsMap.set(id, msg);
      approvedList.push(msg);

      // Automatically update application status to RECRUITER_CONTACTED
      const appKey = `${userId}_${msg.jobId}`;
      let app = memoryStore.applications.get(appKey);
      if (app) {
        app.status = 'RECRUITER_CONTACTED';
        app.updatedAt = new Date().toISOString();
        memoryStore.applications.set(appKey, app);
      }

      // Schedule Day 2, Day 5, Day 10 automated follow-ups via followUpEngineService
      followUpEngineService.scheduleFollowUps({
        userId,
        jobId: msg.jobId,
        jobTitle: msg.jobTitle,
        companyName: msg.companyName,
        recruiterId: msg.recruiterId,
        recruiterName: msg.recruiterName,
        recruiterEmail: msg.recruiterEmail
      });
    }
  }

  return res.json({
    message: `Successfully approved & queued ${approvedList.length} email outreach messages for dispatch`,
    approved: approvedList
  });
};

export const editEmailDraft = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { messageId, subject, body } = req.body;

  const msg = queuedEmailsMap.get(messageId);
  if (!msg || msg.userId !== userId) {
    return res.status(404).json({ error: 'Outreach message draft not found' });
  }

  if (subject) msg.subject = subject;
  if (body) msg.body = body;

  queuedEmailsMap.set(messageId, msg);
  return res.json(msg);
};

export const getDueFollowUps = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const due = followUpEngineService.getDueFollowUps(userId);
  return res.json(due);
};

export const stopFollowUp = async (req: AuthenticatedRequest, res: Response) => {
  const { jobId, recruiterId, condition } = req.body;
  if (!jobId || !recruiterId || !condition) {
    return res.status(400).json({ error: 'jobId, recruiterId, and condition are required' });
  }

  const count = followUpEngineService.evaluateStopCondition(
    jobId, 
    recruiterId, 
    condition as 'REPLIED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'JOB_CLOSED'
  );

  return res.json({
    message: `Automatic stop condition evaluated cleanly. Suppressed ${count} pending follow-up tasks.`,
    suppressedCount: count
  });
};
