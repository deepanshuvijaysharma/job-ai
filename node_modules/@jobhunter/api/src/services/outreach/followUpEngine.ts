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
  public scheduleFollowUps(outreach: {
    userId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    recruiterId: string;
    recruiterName: string;
    recruiterEmail?: string;
  }): FollowUpTask[] {
    const createdTasks: FollowUpTask[] = [];
    const stages = [
      { stage: 1, days: 2, name: 'Stage 1 Nudge' },
      { stage: 2, days: 5, name: 'Stage 2 Project Highlight' },
      { stage: 3, days: 10, name: 'Stage 3 Final Check-in' }
    ];

    stages.forEach(s => {
      const taskId = `fu-${outreach.jobId}-${outreach.recruiterId}-stage${s.stage}`;
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
        scheduledAt: new Date(Date.now() + s.days * 24 * 3600 * 1000).toISOString(),
        status: 'FOLLOWUP_DUE',
        subject: `Follow-up re: ${outreach.jobTitle} at ${outreach.companyName}`,
        body: `Hi ${outreach.recruiterName.split(' ')[0]},\n\nI wanted to briefly follow up on my previous message regarding the ${outreach.jobTitle} role.\n\nBest regards,\nCandidate`,
        createdAt: new Date().toISOString()
      };

      this.followUpsMap.set(taskId, task);
      createdTasks.push(task);
    });

    return createdTasks;
  }

  /**
   * Check and Trigger Immediate Stop Conditions:
   * Suppresses follow-ups immediately if recruiter replied, declined, user cancelled, or job closed.
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
   * Get active due follow-up tasks for user.
   */
  public getDueFollowUps(userId: string): FollowUpTask[] {
    const list: FollowUpTask[] = [];
    for (const task of this.followUpsMap.values()) {
      if (task.userId === userId && task.status === 'FOLLOWUP_DUE') {
        list.push(task);
      }
    }
    return list;
  }
}

export const followUpEngineService = new FollowUpEngineService();
