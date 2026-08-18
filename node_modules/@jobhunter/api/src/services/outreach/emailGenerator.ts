import { aiManager } from '../ai/aiProvider';
import { OutreachMessageType } from '@jobhunter/types';

export type OutreachTemplateType = OutreachMessageType;

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  templateType: OutreachMessageType;
  aiReasoning: string;
}

export class EmailGeneratorService {
  async generatePersonalizedEmail(
    candidate: { name: string; currentRole: string; skills: string[]; projects: any[] },
    job: { title: string; companyName: string; requiredSkills: string[]; location: string },
    recruiter: { name?: string; role?: string },
    templateType: OutreachMessageType = 'INITIAL_OUTREACH'
  ): Promise<GeneratedEmailDraft> {
    const recruiterFirstName = this.extractFirstName(recruiter.name);
    const greeting = recruiterFirstName ? `Hi ${recruiterFirstName},` : 'Hello,';

    const systemPrompt = `You are a Senior AI Recruiter Outreach Specialist.
Generate a concise, professional, highly tailored email for a tech candidate contacting a recruiter/hiring manager.
CRITICAL RULES:
1. Greeting MUST be: "${greeting}".
2. Tailor the message to the actual job title (${job.title}) and candidate's real skills (${candidate.skills.slice(0, 4).join(', ')}).
3. Include a clear, non-pushy call to action.
4. NEVER fabricate false experience, referrals, certifications, or skills.
5. Return JSON object with: { subject, body, templateType, aiReasoning }.`;

    const userPrompt = `Candidate Name: ${candidate.name}
Candidate Role: ${candidate.currentRole}
Candidate Skills: ${candidate.skills.join(', ')}
Candidate Top Project: ${candidate.projects?.[0]?.title || ''}

Job Title: ${job.title}
Company: ${job.companyName}
Location: ${job.location}

Recruiter Name: ${recruiter.name || 'Hiring Team'}
Recruiter Role: ${recruiter.role || 'Recruiter'}
Template Type: ${templateType}`;

    return aiManager.completeJSON<GeneratedEmailDraft>(
      systemPrompt,
      userPrompt,
      () => this.heuristicFallbackEmail(candidate, job, recruiter, templateType)
    );
  }

  public extractFirstName(fullName?: string): string | null {
    if (!fullName || typeof fullName !== 'string') return null;
    const trimmed = fullName.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown' || trimmed.toLowerCase() === 'hiring team' || trimmed.toLowerCase() === 'recruiter') {
      return null;
    }
    const parts = trimmed.split(/\s+/);
    return parts[0] || null;
  }

  private heuristicFallbackEmail(
    candidate: { name: string; currentRole: string; skills: string[]; projects: any[] },
    job: { title: string; companyName: string; requiredSkills: string[] },
    recruiter: { name?: string; role?: string },
    templateType: OutreachMessageType
  ): GeneratedEmailDraft {
    const recruiterFirstName = this.extractFirstName(recruiter.name);
    const greeting = recruiterFirstName ? `Hi ${recruiterFirstName},` : 'Hello,';
    const topSkillsStr = candidate.skills.length > 0 ? candidate.skills.slice(0, 4).join(', ') : 'software engineering';
    const projectTitle = candidate.projects?.[0]?.title ? candidate.projects[0].title : null;
    const projectPhrase = projectTitle ? ` and built ${projectTitle}` : '';

    if (templateType === 'APPLICATION_FOLLOWUP') {
      return {
        subject: `Following up — ${job.title} application (${candidate.name})`,
        body: `${greeting}\n\nI wanted to briefly follow up on my application for the ${job.title} role at ${job.companyName}.\n\nGiven my experience with ${topSkillsStr}${projectPhrase}, I remain very interested in how I can contribute to your engineering team's goals.\n\nI would welcome a brief conversation if you are still reviewing candidates.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Polite application follow-up reinforcing verified technical alignment.`
      };
    }

    if (templateType === 'HIRING_MANAGER_OUTREACH') {
      return {
        subject: `${job.title} role at ${job.companyName} — ${candidate.name}`,
        body: `${greeting}\n\nI noticed that ${job.companyName} is expanding its engineering team for the ${job.title} position.\n\nMy background is centered around ${topSkillsStr}${projectPhrase}.\n\nI would appreciate the chance to connect and share more context on how my experience aligns with your engineering roadmap.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Direct engineering manager outreach focusing on technical skills and projects.`
      };
    }

    if (templateType === 'REFERRAL_REQUEST') {
      return {
        subject: `Inquiry regarding ${job.title} role at ${job.companyName}`,
        body: `${greeting}\n\nI came across the ${job.title} opening at ${job.companyName} and was impressed by your team's work.\n\nWith my background in ${topSkillsStr}, I believe I could add value to your initiatives. If you are open to a brief chat or referral, I would be grateful for a few minutes of your time.\n\nThanks,\n${candidate.name}`,
        templateType,
        aiReasoning: `Polite referral request emphasizing verified skill match.`
      };
    }

    if (templateType === 'INTERVIEW_THANK_YOU') {
      return {
        subject: `Thank you for the interview — ${job.title}`,
        body: `${greeting}\n\nThank you for taking the time to speak with me today about the ${job.title} position at ${job.companyName}.\n\nI enjoyed learning more about your engineering challenges, and I am even more excited about the opportunity to contribute with my expertise in ${topSkillsStr}.\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Post-interview thank-you note highlighting enthusiasm and domain match.`
      };
    }

    if (templateType === 'FINAL_FOLLOWUP') {
      return {
        subject: `Final check-in — ${job.title} role at ${job.companyName}`,
        body: `${greeting}\n\nI am writing to send a final follow-up regarding the ${job.title} position at ${job.companyName}.\n\nI understand your team is busy with hiring priorities. If the position is still open and my profile in ${topSkillsStr} aligns with your needs, I would welcome the opportunity to connect.\n\nThank you for your time and consideration.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Final check-in before concluding outreach sequence.`
      };
    }

    // Default INITIAL_OUTREACH
    return {
      subject: `Application & Inquiry: ${job.title} — ${candidate.name}`,
      body: `${greeting}\n\nI noticed that ${job.companyName} is hiring for a ${job.title} position.\n\nMy background is strongly aligned with ${topSkillsStr}${projectPhrase}.\n\nI have submitted my application through your official portal and would be grateful if you could take a brief look at my profile.\n\nThanks,\n${candidate.name}`,
      templateType: 'INITIAL_OUTREACH',
      aiReasoning: `Custom first-contact email highlighting verified skill overlap.`
    };
  }
}

export const emailGeneratorService = new EmailGeneratorService();
