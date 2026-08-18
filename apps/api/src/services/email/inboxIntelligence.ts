import { aiManager } from '../ai/aiProvider';
import { memoryStore } from '../store';
import { ApplicationDTO, ApplicationStatus, EmailCategory, ExtractedEmailData, ProposedPipelineUpdateDTO } from '@jobhunter/types';
import { inboxRepository, followUpRepository } from '../../repositories/prismaRepository';
import { followUpEngineService } from '../outreach/followUpEngine';

export class InboxIntelligenceService {
  public proposedUpdatesMap: Map<string, ProposedPipelineUpdateDTO> = new Map();

  /**
   * Classify incoming email and extract structured entities using AI with heuristic fallback
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
Extract JSON fields: { category, companyName, jobTitle, recruiterName, recruiterEmail, interviewDate, interviewTime, timezone, meetingLink, assessmentDeadline, compensationDetails, nextAction, confidence (0.0-1.0) }.`;

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
   * Heuristic fallback for classification and entity extraction
   */
  public heuristicClassify(email: { senderEmail: string; senderName?: string; subject: string; body: string }): ExtractedEmailData {
    const text = `${email.subject} ${email.body}`.toLowerCase();
    
    let category: EmailCategory = 'OTHER';
    let proposedNextAction = 'Review email';

    if (text.includes('offer') || (text.includes('congratulations') && text.includes('package'))) {
      category = 'OFFER';
      proposedNextAction = 'Review offer letter and compensation terms';
    } else if (text.includes('interview') || text.includes('schedule') || text.includes('zoom.us') || text.includes('meet.google.com') || text.includes('teams.microsoft.com')) {
      category = 'INTERVIEW_INVITATION';
      proposedNextAction = 'Confirm calendar availability and review interview prep';
    } else if (text.includes('assessment') || text.includes('coding test') || text.includes('hackerrank')) {
      category = 'ASSESSMENT';
      proposedNextAction = 'Complete technical assessment before deadline';
    } else if (text.includes('regret') || text.includes('unfortunately') || text.includes('not moving forward') || text.includes('other candidates')) {
      category = 'REJECTION';
      proposedNextAction = 'Archive application and continue active pipeline';
    } else if (text.includes('received your application') || text.includes('thanks for applying') || text.includes('application confirmation')) {
      category = 'APPLICATION_CONFIRMATION';
      proposedNextAction = 'Track application status';
    } else if (text.includes('interested') || text.includes('chat') || text.includes('available for a quick call') || text.includes('connect')) {
      category = 'RECRUITER_RESPONSE';
      proposedNextAction = 'Respond to recruiter with availability';
    }

    // Extract meeting links regex
    const linkMatch = email.body.match(/https:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s.,)]+/i);
    const meetingLink = linkMatch ? linkMatch[0] : undefined;

    // Extract domain for company name default
    const domainPart = email.senderEmail.split('@')[1]?.split('.')[0] || 'Company';
    const companyName = domainPart.charAt(0).toUpperCase() + domainPart.slice(1);

    return {
      category,
      companyName: companyName !== 'Gmail' && companyName !== 'Outlook' ? companyName : 'Target Company',
      jobTitle: email.subject.includes('Backend') ? 'Backend Developer' : 'Software Engineer',
      recruiterName: email.senderName || 'Recruiter',
      recruiterEmail: email.senderEmail,
      interviewDate: category === 'INTERVIEW_INVITATION' ? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] : undefined,
      interviewTime: category === 'INTERVIEW_INVITATION' ? '11:00 AM' : undefined,
      timezone: 'PST',
      meetingLink,
      nextAction: proposedNextAction,
      confidence: 0.92
    };
  }

  /**
   * Deterministic 4-Tier Application Matcher Engine
   */
  public async matchApplication(
    userId: string,
    email: { senderEmail: string; subject: string; body: string; threadId?: string },
    extracted: ExtractedEmailData
  ): Promise<ApplicationDTO | null> {
    const rawApps = Array.from(memoryStore.applications.values()).filter(a => a.userId === userId);
    if (!rawApps.length) return null;

    const userApps = rawApps.map(a => ({
      ...a,
      job: a.job || memoryStore.jobs.get(a.jobId) || ({ companyName: (a as any).companyName, title: (a as any).jobTitle } as any)
    }));

    const senderEmail = (email.senderEmail || '').toLowerCase().trim();
    const senderDomain = senderEmail.split('@')[1] || '';

    // Tier 1: Match by exact thread ID / email message match in store
    if (email.threadId) {
      const threadMatch = userApps.find(a => (a as any).threadId === email.threadId);
      if (threadMatch) return threadMatch;
    }

    // Tier 2: Match by recruiter email address
    const recruiterMatch = userApps.find(a => {
      const recEmail = ((a as any).recruiterEmail || (a as any).recruiter?.email || '').toLowerCase().trim();
      return recEmail && recEmail === senderEmail;
    });
    if (recruiterMatch) return recruiterMatch;

    // Tier 3: Match by company domain
    if (senderDomain && !['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com'].includes(senderDomain)) {
      const domainMatch = userApps.find(a => {
        const compName = (a.companyName || a.job?.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const domainClean = senderDomain.split('.')[0].toLowerCase();
        return compName && compName.includes(domainClean);
      });
      if (domainMatch) return domainMatch;
    }

    // Tier 4: Match by extracted company name or job title
    const targetComp = (extracted.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetTitle = (extracted.jobTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (targetComp) {
      const entityMatch = userApps.find(a => {
        const appComp = (a.companyName || a.job?.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const appTitle = (a.jobTitle || a.job?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return (appComp && appComp.includes(targetComp)) || (targetTitle && appTitle && appTitle.includes(targetTitle));
      });
      if (entityMatch) return entityMatch;
    }

    // If confidence is low or no matching rule triggered, return null (do NOT manufacture random matches)
    return null;
  }

  /**
   * Map Email Category to Proposed Target Application Status
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
      case 'APPLICATION_CONFIRMATION':
        return ApplicationStatus.APPLIED;
      default:
        return ApplicationStatus.APPLIED;
    }
  }

  /**
   * Create a Human-In-The-Loop Proposed Pipeline Update (Persisted in PostgreSQL)
   */
  public async createProposal(
    userId: string,
    extracted: ExtractedEmailData,
    matchedApp?: ApplicationDTO | null,
    emailMessageId?: string
  ): Promise<ProposedPipelineUpdateDTO> {
    const proposedStatus = this.getProposedStatus(extracted.category);
    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const proposal: ProposedPipelineUpdateDTO = {
      id: proposalId,
      userId,
      matchedApplicationId: matchedApp?.id || undefined,
      emailMessageId,
      companyName: extracted.companyName || matchedApp?.job?.companyName || 'Target Company',
      jobTitle: extracted.jobTitle || matchedApp?.job?.title || 'Target Position',
      emailCategory: extracted.category,
      proposedStatus,
      extractedDetails: extracted,
      isConfirmed: false,
      createdAt: new Date().toISOString()
    };

    // Idempotent write to PostgreSQL database (Source of Truth)
    await inboxRepository.createProposal(proposal);
    this.proposedUpdatesMap.set(proposalId, proposal);

    // Automatic Follow-Up Suppression upon recruiter reply / response detection
    if (matchedApp && ['RECRUITER_RESPONSE', 'INTERVIEW_INVITATION', 'OFFER', 'REJECTION', 'ASSESSMENT'].includes(extracted.category)) {
      await followUpEngineService.cancelFollowUpsForApplication(
        matchedApp.id,
        (matchedApp as any).recruiterId,
        extracted.category
      );
    }

    return proposal;
  }

  /**
   * Confirm Proposed Pipeline Update (User Approval)
   */
  public async confirmProposal(proposalId: string): Promise<ProposedPipelineUpdateDTO> {
    let proposal = this.proposedUpdatesMap.get(proposalId);

    if (!proposal) {
      proposal = await inboxRepository.findProposalById(proposalId);
    }

    if (!proposal) {
      throw new Error('Proposed pipeline update not found');
    }

    proposal.isConfirmed = true;

    // Apply state change in memory store and PostgreSQL
    if (proposal.matchedApplicationId) {
      for (const [key, app] of memoryStore.applications.entries()) {
        if (app.id === proposal.matchedApplicationId || key === proposal.matchedApplicationId) {
          app.status = proposal.proposedStatus;
          app.updatedAt = new Date().toISOString();
          memoryStore.applications.set(key, app);
        }
      }

      await inboxRepository.confirmProposal(proposalId, proposal.matchedApplicationId, proposal.proposedStatus);

      // Suppress pending follow-ups cleanly
      await followUpEngineService.cancelFollowUpsForApplication(
        proposal.matchedApplicationId,
        undefined,
        proposal.emailCategory
      );
    }

    return proposal;
  }

  /**
   * Reject / Dismiss Proposal
   */
  public async rejectProposal(proposalId: string): Promise<boolean> {
    this.proposedUpdatesMap.delete(proposalId);
    await inboxRepository.deleteProposal(proposalId);
    return true;
  }
}

export const inboxIntelligenceService = new InboxIntelligenceService();
