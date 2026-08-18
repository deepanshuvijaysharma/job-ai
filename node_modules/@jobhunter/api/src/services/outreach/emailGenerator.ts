import { aiManager } from '../ai/aiProvider';

export type OutreachTemplateType = 
  | 'INITIAL_OUTREACH' 
  | 'FIRST_CONTACT' 
  | 'APPLICATION_FOLLOWUP' 
  | 'RECRUITER_RESPONSE' 
  | 'HIRING_MANAGER_OUTREACH' 
  | 'REFERRAL_REQUEST' 
  | 'INTERVIEW_THANK_YOU';

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  templateType: OutreachTemplateType;
  aiReasoning: string;
}

export class EmailGeneratorService {
  async generatePersonalizedEmail(
    candidate: { name: string; currentRole: string; skills: string[]; projects: any[] },
    job: { title: string; companyName: string; requiredSkills: string[]; location: string },
    recruiter: { name: string; role: string },
    templateType: OutreachTemplateType = 'INITIAL_OUTREACH'
  ): Promise<GeneratedEmailDraft> {
    
    const systemPrompt = `You are a Senior AI Recruiter Outreach Specialist.
Generate a concise, professional, highly tailored email for a tech candidate contacting a recruiter/hiring manager.
CRITICAL RULES:
1. NEVER use generic lines like "Dear Sir/Madam, I am looking for a job...".
2. Address the recruiter by first name ("Hi ${recruiter.name.split(' ')[0]}").
3. Tailor the message to the actual job title (${job.title}) and candidate's real skills (${candidate.skills.slice(0, 4).join(', ')}).
4. Include a clear, non-pushy call to action.
5. NEVER fabricate false experience, referrals, or skills.
6. Return JSON object with: { subject, body, templateType, aiReasoning }.`;

    const userPrompt = `Candidate Name: ${candidate.name}
Candidate Role: ${candidate.currentRole}
Candidate Skills: ${candidate.skills.join(', ')}
Candidate Top Project: ${candidate.projects?.[0]?.title || 'Production Microservices Platform'}

Job Title: ${job.title}
Company: ${job.companyName}
Location: ${job.location}

Recruiter Name: ${recruiter.name}
Recruiter Role: ${recruiter.role}
Template Type: ${templateType}`;

    return aiManager.completeJSON<GeneratedEmailDraft>(
      systemPrompt,
      userPrompt,
      () => this.heuristicFallbackEmail(candidate, job, recruiter, templateType)
    );
  }

  private heuristicFallbackEmail(
    candidate: { name: string; currentRole: string; skills: string[]; projects: any[] },
    job: { title: string; companyName: string; requiredSkills: string[] },
    recruiter: { name: string; role: string },
    templateType: OutreachTemplateType
  ): GeneratedEmailDraft {
    const firstName = recruiter.name.split(' ')[0] || 'there';
    const topSkillsStr = candidate.skills.slice(0, 4).join(', ');
    const projectTitle = candidate.projects?.[0]?.title || 'production full-stack applications';

    if (templateType === 'APPLICATION_FOLLOWUP') {
      return {
        subject: `Following up — ${job.title} application (${candidate.name})`,
        body: `Hi ${firstName},\n\nI wanted to briefly follow up on my application for the ${job.title} role at ${job.companyName}.\n\nGiven my experience building ${projectTitle} using ${topSkillsStr}, I remain very interested in how I can contribute to your engineering team's current goals.\n\nI would welcome a brief conversation if you are still reviewing candidates.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Polite follow-up reinforcing technical alignment without spamming.`
      };
    }

    if (templateType === 'HIRING_MANAGER_OUTREACH') {
      return {
        subject: `${job.title} role at ${job.companyName} — ${candidate.name}`,
        body: `Hi ${firstName},\n\nI noticed that ${job.companyName} is expanding its engineering team for the ${job.title} position.\n\nMy background is centered around ${topSkillsStr}, and I recently architected ${projectTitle}.\n\nI would appreciate the chance to connect and share more context on how my experience aligns with your roadmap.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Direct engineering manager outreach focusing on technical project outcomes.`
      };
    }

    if (templateType === 'REFERRAL_REQUEST') {
      return {
        subject: `Inquiry regarding ${job.title} role at ${job.companyName}`,
        body: `Hi ${firstName},\n\nI came across the ${job.title} opening at ${job.companyName} and was impressed by your team's work.\n\nWith my background in ${topSkillsStr}, I believe I could add value to your current initiatives. If you are open to a brief chat or referral, I would be grateful for a few minutes of your time.\n\nThanks,\n${candidate.name}`,
        templateType,
        aiReasoning: `Polite referral request emphasizing mutual engineering domain interest.`
      };
    }

    if (templateType === 'INTERVIEW_THANK_YOU') {
      return {
        subject: `Thank you for the interview — ${job.title}`,
        body: `Hi ${firstName},\n\nThank you for taking the time to speak with me today about the ${job.title} position at ${job.companyName}.\n\nI enjoyed learning more about your engineering challenges, and I am even more excited about the opportunity to contribute with my expertise in ${topSkillsStr}.\n\nPlease let me know if you need any additional information.\n\nBest regards,\n${candidate.name}`,
        templateType,
        aiReasoning: `Post-interview thank-you note highlighting enthusiasm and domain match.`
      };
    }

    // Default INITIAL_OUTREACH / FIRST_CONTACT
    return {
      subject: `Application & Inquiry: ${job.title} — ${candidate.name}`,
      body: `Hi ${firstName},\n\nI noticed that ${job.companyName} is hiring for a ${job.title} position.\n\nMy background is strongly aligned with ${topSkillsStr}, and I have built ${projectTitle} around these technologies.\n\nI have submitted my application through your official portal and would be grateful if you could take a brief look at my profile.\n\nThanks,\n${candidate.name}`,
      templateType: 'INITIAL_OUTREACH',
      aiReasoning: `Custom first-contact email highlighting core skill overlap and project demonstration.`
    };
  }
}

export const emailGeneratorService = new EmailGeneratorService();
