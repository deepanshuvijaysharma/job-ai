import { followUpRepository, userRepository, profileRepository, emailRepository } from '../../repositories/prismaRepository';
import { emailGeneratorService } from './emailGenerator';
import { queuedEmailsMap } from '../../controllers/outreachController';
import { OutreachMessageType } from '@jobhunter/types';

export type FollowUpStatus = 
  | 'SCHEDULED'
  | 'DUE'
  | 'DRAFT' 
  | 'APPROVED' 
  | 'SENT' 
  | 'REPLIED' 
  | 'DECLINED' 
  | 'CANCELLED' 
  | 'JOB_CLOSED';

export interface FollowUpTaskState {
  id: string;
  userId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail?: string;
  candidateName: string;
  stage: number; // 1 = Day 2, 2 = Day 5, 3 = Day 10
  scheduledForDays: number;
  scheduledAt: string;
  status: FollowUpStatus;
  stopReason?: string;
  cancelReason?: string;
  cancelledAt?: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export class FollowUpEngineService {
  // In-Memory Fallback Cache for Offline Dev/Test Environments Only (PostgreSQL is Source of Truth)
  private fallbackCache: Map<string, FollowUpTaskState> = new Map();

  /**
   * Helper: Dynamically fetch candidate identity from PostgreSQL User/Profile
   */
  public async resolveCandidateName(userId: string, explicitCandidateName?: string): Promise<string> {
    if (explicitCandidateName && explicitCandidateName.trim().length > 0 && explicitCandidateName !== 'Candidate') {
      return explicitCandidateName.trim();
    }

    const user = await userRepository.findById(userId);
    if (user && user.name && user.name.trim().length > 0 && user.name !== 'Candidate') {
      return user.name.trim();
    }

    const profile = await profileRepository.findByUserId(userId);
    if (profile && (profile as any).fullName && (profile as any).fullName.trim().length > 0) {
      return (profile as any).fullName.trim();
    }

    return '';
  }

  /**
   * 1. Schedule Multi-Stage Follow-Ups in PostgreSQL (SCHEDULED status)
   */
  public async scheduleFollowUps(outreach: {
    userId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    recruiterId: string;
    recruiterName: string;
    recruiterEmail?: string;
    candidateName?: string;
  }): Promise<FollowUpTaskState[]> {
    const candidateName = await this.resolveCandidateName(outreach.userId, outreach.candidateName);
    const recruiterFirstName = emailGeneratorService.extractFirstName(outreach.recruiterName);
    const greeting = recruiterFirstName ? `Hi ${recruiterFirstName},` : 'Hello,';
    const signature = candidateName ? `\n\nBest regards,\n${candidateName}` : `\n\nBest regards,`;

    const stages = [
      { stage: 1, days: 2, name: 'Stage 1 Nudge' },
      { stage: 2, days: 5, name: 'Stage 2 Highlight' },
      { stage: 3, days: 10, name: 'Stage 3 Final Check-in' }
    ];

    const tasks: FollowUpTaskState[] = [];

    await Promise.all(stages.map(async s => {
      const taskId = `fu-${outreach.jobId}-${outreach.recruiterId}-stage${s.stage}`;
      const scheduledDate = new Date(Date.now() + s.days * 24 * 3600 * 1000);

      const subject = s.stage === 3 
        ? `Final check-in — ${outreach.jobTitle} role at ${outreach.companyName}`
        : `Following up: ${outreach.jobTitle} at ${outreach.companyName}`;

      const body = s.stage === 3
        ? `${greeting}\n\nI am sending a final follow-up regarding my application for the ${outreach.jobTitle} role at ${outreach.companyName}.\n\nIf the position is still open, I would appreciate the opportunity to connect.${signature}`
        : `${greeting}\n\nI wanted to briefly follow up on my previous message regarding the ${outreach.jobTitle} role at ${outreach.companyName}.${signature}`;

      const taskState: FollowUpTaskState = {
        id: taskId,
        userId: outreach.userId,
        applicationId: outreach.jobId,
        jobId: outreach.jobId,
        jobTitle: outreach.jobTitle,
        companyName: outreach.companyName,
        recruiterId: outreach.recruiterId,
        recruiterName: outreach.recruiterName,
        recruiterEmail: outreach.recruiterEmail,
        candidateName,
        stage: s.stage,
        scheduledForDays: s.days,
        scheduledAt: scheduledDate.toISOString(),
        status: 'SCHEDULED',
        subject,
        body,
        createdAt: new Date().toISOString()
      };

      await followUpRepository.upsertFollowUp({
        id: taskId,
        applicationId: outreach.jobId,
        recruiterId: outreach.recruiterId,
        userId: outreach.userId,
        stepNumber: s.stage,
        scheduledAt: scheduledDate,
        status: 'SCHEDULED',
        suggestedSubject: subject,
        suggestedBody: body
      });

      this.fallbackCache.set(taskId, taskState);
      tasks.push(taskState);
    }));

    return tasks;
  }

  /**
   * 2. Query Genuine Due Follow-Ups directly from PostgreSQL filtered strictly by userId
   */
  public async getDueFollowUps(userId: string, referenceDate: Date = new Date()): Promise<FollowUpTaskState[]> {
    const dbDue = await followUpRepository.findDueFollowUps(userId, referenceDate);

    if (dbDue && dbDue.length > 0) {
      return Promise.all(dbDue.map(async f => {
        const candidateName = await this.resolveCandidateName(userId);
        return {
          id: f.id,
          userId: f.userId || userId,
          applicationId: f.applicationId,
          jobId: f.applicationId,
          jobTitle: f.application?.job?.title || 'Engineering Role',
          companyName: (f.application?.job as any)?.companyName || (f.application?.job as any)?.company?.name || 'Target Company',
          recruiterId: f.recruiterId || 'rec-1',
          recruiterName: f.recruiter?.name || 'Recruiter',
          recruiterEmail: f.recruiter?.email || undefined,
          candidateName,
          stage: f.stepNumber,
          scheduledForDays: f.stepNumber === 1 ? 2 : f.stepNumber === 2 ? 5 : 10,
          scheduledAt: f.scheduledAt.toISOString(),
          status: (new Date(f.scheduledAt).getTime() <= referenceDate.getTime() ? 'DUE' : f.status) as FollowUpStatus,
          cancelReason: f.cancelReason || undefined,
          cancelledAt: f.cancelledAt ? f.cancelledAt.toISOString() : undefined,
          subject: f.suggestedSubject || `Follow-up re: Application`,
          body: f.suggestedBody || `Following up...`,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt ? f.updatedAt.toISOString() : undefined
        };
      }));
    }

    // Fallback to in-memory cache if PostgreSQL is offline
    const dueFromCache: FollowUpTaskState[] = [];
    for (const task of this.fallbackCache.values()) {
      if (task.userId === userId && !task.cancelledAt && (task.status === 'SCHEDULED' || task.status === 'DUE')) {
        const scheduledTime = new Date(task.scheduledAt).getTime();
        if (scheduledTime <= referenceDate.getTime()) {
          task.status = 'DUE';
          dueFromCache.push(task);
        }
      }
    }
    return dueFromCache;
  }

  /**
   * 3. Evaluate & Persist Stop Conditions in PostgreSQL
   */
  public async evaluateStopCondition(
    jobId: string, 
    recruiterId: string, 
    condition: 'REPLIED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'JOB_CLOSED' | 'INTERVIEW_SCHEDULED' | 'TECHNICAL_ROUND' | 'HR_ROUND' | 'OFFER'
  ): Promise<number> {
    return this.cancelFollowUpsForApplication(jobId, recruiterId, condition);
  }

  /**
   * Clean Service Interface for Cancelling Follow-Ups (Called by Step 9 or user events)
   */
  public async cancelFollowUpsForApplication(
    applicationId: string,
    recruiterId?: string,
    reason: string = 'STOP_CONDITION'
  ): Promise<number> {
    const result = await followUpRepository.cancelFollowUpsForApplication(applicationId, recruiterId, reason);
    let suppressedCount = result?.count || 0;

    for (const [id, task] of this.fallbackCache.entries()) {
      if (task.applicationId === applicationId && (!recruiterId || task.recruiterId === recruiterId) && !task.cancelledAt) {
        task.status = 'CANCELLED';
        task.cancelReason = reason;
        task.cancelledAt = new Date().toISOString();
        task.stopReason = `Automatic Stop Condition Triggered: ${reason}`;
        suppressedCount++;
      }
    }

    return suppressedCount;
  }

  /**
   * 4. Process Due Follow-Ups: Creates Human-Approval Drafts in PostgreSQL (isApproved = false, status = DRAFT)
   * Enforces strict PostgreSQL-backed idempotency & durability across process restarts.
   */
  public async processDueFollowUps(userId: string, referenceDate: Date = new Date()): Promise<any[]> {
    const dueTasks = await this.getDueFollowUps(userId, referenceDate);
    const createdDrafts: any[] = [];

    for (const task of dueTasks) {
      if (task.status === 'CANCELLED' || task.cancelledAt) continue;

      const draftId = `draft-fu-${task.id}`;

      // Synchronous Lock & Idempotency Check for Parallel Workers
      if (queuedEmailsMap.has(draftId)) {
        const existing = queuedEmailsMap.get(draftId);
        if (existing && existing.subject) {
          continue;
        }
        if (existing && (existing as any).isReserved) {
          continue;
        }
      }

      if (task.status === 'DRAFT') continue;

      // 1. PostgreSQL Idempotency Check
      const existingMessage = await emailRepository.findMessageById(draftId);
      if (existingMessage) {
        if (!queuedEmailsMap.has(draftId)) {
          queuedEmailsMap.set(draftId, {
            id: existingMessage.id,
            userId: task.userId,
            jobId: task.jobId,
            jobTitle: task.jobTitle,
            companyName: task.companyName,
            recruiterId: task.recruiterId,
            recruiterName: task.recruiterName,
            recruiterEmail: task.recruiterEmail,
            recruiterRole: 'Recruiter',
            subject: existingMessage.subject,
            body: existingMessage.body,
            templateType: (task.stage === 3 ? 'FINAL_FOLLOWUP' : 'APPLICATION_FOLLOWUP') as OutreachMessageType,
            isApproved: existingMessage.isApproved,
            aiReasoning: `Automated Stage ${task.stage} Follow-Up Draft due for human approval.`,
            confidence: 0.95,
            createdAt: existingMessage.createdAt.toISOString()
          });
        }
        continue;
      }

      // Atomic lock out of concurrent calls
      queuedEmailsMap.set(draftId, { id: draftId, isReserved: true } as any);

      // 2. Build Queued Draft DTO
      const queuedDraft = {
        id: draftId,
        userId: task.userId,
        jobId: task.jobId,
        jobTitle: task.jobTitle,
        companyName: task.companyName,
        recruiterId: task.recruiterId,
        recruiterName: task.recruiterName,
        recruiterEmail: task.recruiterEmail,
        recruiterRole: 'Recruiter',
        subject: task.subject,
        body: task.body,
        templateType: (task.stage === 3 ? 'FINAL_FOLLOWUP' : 'APPLICATION_FOLLOWUP') as OutreachMessageType,
        isApproved: false, // MANDATORY HUMAN APPROVAL
        aiReasoning: `Automated Stage ${task.stage} Follow-Up Draft due for human approval.`,
        confidence: 0.95,
        createdAt: new Date().toISOString()
      };

      // 3. Persist Draft in PostgreSQL EmailMessage table
      await emailRepository.recordDispatchMessage({
        id: draftId,
        accountId: `acc-${task.userId}`,
        recruiterId: task.recruiterId,
        applicationId: task.applicationId,
        subject: task.subject,
        body: task.body,
        isApproved: false,
        status: 'DRAFT'
      });

      queuedEmailsMap.set(draftId, queuedDraft);

      // 4. Persist FollowUp -> Draft relationship (FollowUp.sourceMessageId = EmailMessage.id)
      await followUpRepository.updateFollowUpStatus(task.id, 'DRAFT', { sourceMessageId: draftId });

      if (this.fallbackCache.has(task.id)) {
        const cached = this.fallbackCache.get(task.id)!;
        cached.status = 'DRAFT';
      }

      createdDrafts.push(queuedDraft);
    }

    return createdDrafts;
  }

  /**
   * Direct method to seed or reset state in tests
   */
  public saveToFallbackCache(task: FollowUpTaskState) {
    this.fallbackCache.set(task.id, task);
  }

  public clearCache() {
    this.fallbackCache.clear();
  }
}

export const followUpEngineService = new FollowUpEngineService();
