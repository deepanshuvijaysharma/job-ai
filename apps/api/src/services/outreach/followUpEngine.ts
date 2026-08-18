import { followUpRepository } from '../../repositories/prismaRepository';
import { emailGeneratorService } from './emailGenerator';

export type FollowUpStatus = 
  | 'DRAFT' 
  | 'APPROVED' 
  | 'SENT' 
  | 'REPLIED' 
  | 'DECLINED' 
  | 'FOLLOWUP_DUE' 
  | 'CANCELLED' 
  | 'JOB_CLOSED';

export interface FollowUpTask {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  recruiterId: string;
  recruiterName: string;
  recruiterEmail?: string;
  stage: number; // 1 = Day 2, 2 = Day 5, 3 = Day 10
  scheduledForDays: number;
  scheduledAt: string;
  status: FollowUpStatus;
  stopReason?: string;
  subject: string;
  body: string;
  createdAt: string;
}

export class FollowUpEngineService {
  public followUpsMap: Map<string, FollowUpTask> = new Map();

  /**
   * Schedule multi-stage follow-ups after an initial outreach message is sent.
   */
  public async scheduleFollowUps(outreach: {
    userId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    recruiterId: string;
    recruiterName: string;
    recruiterEmail?: string;
  }): Promise<FollowUpTask[]> {
    const createdTasks: FollowUpTask[] = [];
    const stages = [
      { stage: 1, days: 2, name: 'Stage 1 Nudge' },
      { stage: 2, days: 5, name: 'Stage 2 Highlight' },
      { stage: 3, days: 10, name: 'Stage 3 Final Check-in' }
    ];

    const recruiterFirstName = emailGeneratorService.extractFirstName(outreach.recruiterName);
    const greeting = recruiterFirstName ? `Hi ${recruiterFirstName},` : 'Hello,';

    for (const s of stages) {
      const taskId = `fu-${outreach.jobId}-${outreach.recruiterId}-stage${s.stage}`;
      const scheduledDate = new Date(Date.now() + s.days * 24 * 3600 * 1000);

      const subject = s.stage === 3 
        ? `Final check-in — ${outreach.jobTitle} role at ${outreach.companyName}`
        : `Following up: ${outreach.jobTitle} at ${outreach.companyName}`;

      const body = s.stage === 3
        ? `${greeting}\n\nI am sending a final follow-up regarding my application for the ${outreach.jobTitle} role at ${outreach.companyName}.\n\nIf the position is still open, I would appreciate the opportunity to connect.\n\nBest regards,\nCandidate`
        : `${greeting}\n\nI wanted to briefly follow up on my previous message regarding the ${outreach.jobTitle} role at ${outreach.companyName}.\n\nBest regards,\nCandidate`;

      const task: FollowUpTask = {
        id: taskId,
        userId: outreach.userId,
        jobId: outreach.jobId,
        jobTitle: outreach.jobTitle,
        companyName: outreach.companyName,
        recruiterId: outreach.recruiterId,
        recruiterName: outreach.recruiterName,
        recruiterEmail: outreach.recruiterEmail,
        stage: s.stage,
        scheduledForDays: s.days,
        scheduledAt: scheduledDate.toISOString(),
        status: 'FOLLOWUP_DUE',
        subject,
        body,
        createdAt: new Date().toISOString()
      };

      // Persist to PostgreSQL database via Prisma
      await followUpRepository.create({
        applicationId: outreach.jobId,
        scheduledFor: scheduledDate,
        stepNumber: s.stage,
        suggestedBody: body
      });

      this.followUpsMap.set(taskId, task);
      createdTasks.push(task);
    }

    return createdTasks;
  }

  /**
   * Check and Trigger Immediate Stop Conditions:
   * Suppresses follow-ups immediately if recruiter replied, declined, rejected, cancelled, or job closed.
   */
  public evaluateStopCondition(
    jobId: string, 
    recruiterId: string, 
    condition: 'REPLIED' | 'DECLINED' | 'REJECTED' | 'CANCELLED' | 'JOB_CLOSED'
  ): number {
    let suppressedCount = 0;

    for (const [id, task] of this.followUpsMap.entries()) {
      if (task.jobId === jobId && task.recruiterId === recruiterId && task.status === 'FOLLOWUP_DUE') {
        task.status = condition as FollowUpStatus;
        task.stopReason = `Automatic Stop Condition Triggered: ${condition}`;
        suppressedCount++;
      }
    }

    return suppressedCount;
  }

  /**
   * Get Due Follow-Up Tasks for User
   */
  public getDueFollowUps(userId: string): FollowUpTask[] {
    return Array.from(this.followUpsMap.values()).filter(
      t => t.userId === userId && t.status === 'FOLLOWUP_DUE'
    );
  }
}

export const followUpEngineService = new FollowUpEngineService();
