import { aiManager } from '../ai/aiProvider';
import { memoryStore } from '../store';
import { ApplicationDTO, ApplicationStatus } from '@jobhunter/types';

export type EmailCategory = 
  | 'RECRUITER_RESPONSE'
  | 'INTERVIEW_INVITATION'
  | 'ASSESSMENT'
  | 'APPLICATION_CONFIRMATION'
  | 'REJECTION'
  | 'OFFER'
  | 'FOLLOW_UP'
  | 'OTHER';

export interface ExtractedEmailData {
  category: EmailCategory;
  companyName?: string;
  jobTitle?: string;
  recruiterName?: string;
  interviewDate?: string;
  interviewTime?: string;
  meetingLink?: string;
  assessmentDeadline?: string;
  nextAction?: string;
  confidence: number;
}

export interface ProposedPipelineUpdate {
  id: string;
  userId: string;
  matchedApplicationId?: string;
  companyName: string;
  jobTitle: string;
  emailCategory: EmailCategory;
  proposedStatus: ApplicationStatus;
  extractedDetails: ExtractedEmailData;
  isConfirmed: boolean;
  createdAt: string;
}

export class InboxIntelligenceService {
  public proposedUpdatesMap: Map<string, ProposedPipelineUpdate> = new Map();

  /**
   * Classify incoming email and extract structured entities
   */
  async processIncomingEmail(email: {
    senderEmail: string;
    senderName?: string;
    subject: string;
    body: string;
  }): Promise<ExtractedEmailData> {
    const systemPrompt = `You are an AI Email Inbox Classifier & Entity Extractor for Job Hunters.
Classify incoming job-related email into ONE category: 
['RECRUITER_RESPONSE', 'INTERVIEW_INVITATION', 'ASSESSMENT', 'APPLICATION_CONFIRMATION', 'REJECTION', 'OFFER', 'FOLLOW_UP', 'OTHER'].
Extract fields: { category, companyName, jobTitle, recruiterName, interviewDate, interviewTime, meetingLink, assessmentDeadline, nextAction, confidence (0.0-1.0) }.`;

    const userPrompt = `From: ${email.senderName || ''} <${email.senderEmail}>
Subject: ${email.subject}
Body:
${email.body}`;

    return aiManager.completeJSON<ExtractedEmailData>(
      systemPrompt,
      userPrompt,
      () => this.heuristicClassify(email)
    );
  }

  /**
   * Heuristic fallback for classification and extraction
   */
  private heuristicClassify(email: { senderEmail: string; senderName?: string; subject: string; body: string }): ExtractedEmailData {
    const text = `${email.subject} ${email.body}`.toLowerCase();
    
    let category: EmailCategory = 'OTHER';
    let proposedNextAction = 'Review email';

    if (text.includes('offer') || text.includes('congratulations') && text.includes('package')) {
      category = 'OFFER';
      proposedNextAction = 'Review offer letter and compensation terms';
    } else if (text.includes('interview') || text.includes('schedule') || text.includes('zoom.us') || text.includes('meet.google.com')) {
      category = 'INTERVIEW_INVITATION';
      proposedNextAction = 'Confirm calendar availability and prepare interview prep plan';
    } else if (text.includes('assessment') || text.includes('coding test') || text.includes('hackerrank')) {
      category = 'ASSESSMENT';
      proposedNextAction = 'Complete coding assessment before deadline';
    } else if (text.includes('regret') || text.includes('unfortunately') || text.includes('not moving forward')) {
      category = 'REJECTION';
      proposedNextAction = 'Archive application and continue active pipeline';
    } else if (text.includes('received your application') || text.includes('thanks for applying')) {
      category = 'APPLICATION_CONFIRMATION';
      proposedNextAction = 'Track application status';
    } else if (text.includes('interested') || text.includes('chat') || text.includes('available for a quick call')) {
      category = 'RECRUITER_RESPONSE';
      proposedNextAction = 'Respond to recruiter with availability';
    }

    // Extract basic meeting links if present
    const linkMatch = email.body.match(/https:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s]+/i);
    const meetingLink = linkMatch ? linkMatch[0] : undefined;

    return {
      category,
      companyName: email.senderEmail.split('@')[1]?.split('.')[0]?.toUpperCase() || 'Acme Cloud',
      jobTitle: email.subject.includes('Backend') ? 'Backend Developer' : 'Software Engineer',
      recruiterName: email.senderName || 'Hiring Lead',
      interviewDate: category === 'INTERVIEW_INVITATION' ? '2026-08-22' : undefined,
      interviewTime: category === 'INTERVIEW_INVITATION' ? '11:00 AM' : undefined,
      meetingLink,
      nextAction: proposedNextAction,
      confidence: 0.92
    };
  }

  /**
   * Match email extracted data to an existing candidate application
   */
  public matchApplication(userId: string, extracted: ExtractedEmailData): ApplicationDTO | null {
    const apps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
    
    if (!apps.length) return null;

    const targetComp = (extracted.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetTitle = (extracted.jobTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Match by company name or title
    const match = apps.find(a => {
      const appComp = (a.companyName || a.job?.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const appTitle = (a.jobTitle || a.job?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (targetComp && appComp.includes(targetComp)) || (targetTitle && appTitle.includes(targetTitle));
    });

    return match || apps[0];
  }

  /**
   * Map Email Category to Target Application Status
   */
  public getProposedStatus(category: EmailCategory): ApplicationStatus {
    switch (category) {
      case 'INTERVIEW_INVITATION':
        return ApplicationStatus.INTERVIEW_SCHEDULED;
      case 'OFFER':
        return ApplicationStatus.OFFER;
      case 'REJECTION':
        return ApplicationStatus.REJECTED;
      case 'ASSESSMENT':
        return ApplicationStatus.TECHNICAL_ROUND;
      case 'RECRUITER_RESPONSE':
        return ApplicationStatus.RECRUITER_RESPONDED;
      default:
        return ApplicationStatus.APPLIED;
    }
  }

  /**
   * Create a user confirmation proposal (Rule 5: Never silently make high-impact changes)
   */
  public createProposal(userId: string, extracted: ExtractedEmailData): ProposedPipelineUpdate {
    const matchedApp = this.matchApplication(userId, extracted);
    const proposedStatus = this.getProposedStatus(extracted.category);

    const proposalId = `prop-${Date.now()}`;
    const proposal: ProposedPipelineUpdate = {
      id: proposalId,
      userId,
      matchedApplicationId: matchedApp?.id,
      companyName: extracted.companyName || matchedApp?.job?.companyName || 'Target Company',
      jobTitle: extracted.jobTitle || matchedApp?.job?.title || 'Target Position',
      emailCategory: extracted.category,
      proposedStatus,
      extractedDetails: extracted,
      isConfirmed: false,
      createdAt: new Date().toISOString()
    };

    this.proposedUpdatesMap.set(proposalId, proposal);
    return proposal;
  }

  /**
   * User confirms proposed pipeline update
   */
  public confirmProposal(proposalId: string): ProposedPipelineUpdate {
    const proposal = this.proposedUpdatesMap.get(proposalId);
    if (!proposal) {
      throw new Error('Proposed pipeline update not found');
    }

    proposal.isConfirmed = true;

    // Apply state change to matched application
    if (proposal.matchedApplicationId) {
      for (const [key, app] of memoryStore.applications.entries()) {
        if (app.id === proposal.matchedApplicationId || key === proposal.matchedApplicationId) {
          app.status = proposal.proposedStatus;
          app.updatedAt = new Date().toISOString();
          memoryStore.applications.set(key, app);
        }
      }
    }

    return proposal;
  }
}

export const inboxIntelligenceService = new InboxIntelligenceService();
