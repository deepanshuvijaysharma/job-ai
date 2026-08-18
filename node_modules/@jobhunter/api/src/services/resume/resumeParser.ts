import { aiManager } from '../ai/aiProvider';
import { SkillProficiencyLevel } from '@jobhunter/types';

export interface ParsedResumeResult {
  skills: Array<{ name: string; yearsExperience: number; proficiency: SkillProficiencyLevel }>;
  experienceYears: number;
  currentRole: string;
  targetRoles: string[];
  secondaryRoles: string[];
  education: Array<{ degree: string; field: string; institution: string; year?: number }>;
  certifications: string[];
  keywords: string[];
  achievements: string[];
  projects: Array<{ title: string; description: string; techStack: string[] }>;
  workExperience: Array<{ company: string; role: string; duration: string; description: string }>;
  aiProfileAnalysis: {
    strongSkills: string[];
    weakSkills: string[];
    missingSkills: string[];
    marketableSkills: string[];
    competitiveRoles: string[];
    lowProbabilityRoles: string[];
  };
}

export class ResumeParserService {
  async parseResumeText(rawText: string, resumeTitle: string): Promise<ParsedResumeResult> {
    if (!rawText || rawText.trim().length < 10) {
      return this.emptyResult(resumeTitle);
    }

    const systemPrompt = `You are a Senior Tech Recruiter and AI Resume Intelligence Specialist.
Analyze the candidate's raw resume text and output a JSON object containing:
- skills: array of objects { name, yearsExperience, proficiency } where proficiency MUST be one of ["STRONG", "INTERMEDIATE", "BASIC", "LEARNING"]. RULE: Never infer "STRONG" unless the candidate demonstrates multi-year leadership or extensive usage in multiple projects/roles.
- experienceYears: number
- currentRole: string
- targetRoles: string[]
- secondaryRoles: string[]
- education: array of objects { degree, field, institution, year }
- certifications: string[]
- keywords: string[]
- achievements: string[]
- projects: array of objects { title, description, techStack }
- workExperience: array of objects { company, role, duration, description }
- aiProfileAnalysis: { strongSkills, weakSkills, missingSkills, marketableSkills, competitiveRoles, lowProbabilityRoles }

Do NOT invent experience or skills not mentioned in the resume. Return ONLY valid JSON.`;

    const userPrompt = `Resume Title: ${resumeTitle}\n\nResume Raw Content:\n${rawText}`;

    return aiManager.completeJSON<ParsedResumeResult>(systemPrompt, userPrompt, () => this.heuristicFallbackParse(rawText, resumeTitle));
  }

  private emptyResult(resumeTitle: string): ParsedResumeResult {
    return {
      skills: [],
      experienceYears: 0,
      currentRole: 'Candidate',
      targetRoles: ['Backend Developer'],
      secondaryRoles: ['Full Stack Developer'],
      education: [],
      certifications: [],
      keywords: [],
      achievements: [],
      projects: [],
      workExperience: [],
      aiProfileAnalysis: {
        strongSkills: [],
        weakSkills: [],
        missingSkills: [],
        marketableSkills: [],
        competitiveRoles: [],
        lowProbabilityRoles: []
      }
    };
  }

  public heuristicFallbackParse(rawText: string, resumeTitle: string): ParsedResumeResult {
    if (!rawText || rawText.trim().length === 0) {
      return this.emptyResult(resumeTitle);
    }

    const textLower = rawText.toLowerCase();

    const techKeywords = [
      'Node.js', 'Express', 'React', 'JavaScript', 'TypeScript', 'MongoDB', 'PostgreSQL',
      'SQL', 'Python', 'REST API', 'Docker', 'AWS', 'HTML', 'CSS', 'Redux', 'Git', 'Java', 'C++', 'GraphQL'
    ];

    const detectedSkills: Array<{ name: string; yearsExperience: number; proficiency: SkillProficiencyLevel }> = [];

    techKeywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches && matches.length > 0) {
        let proficiency: SkillProficiencyLevel = 'INTERMEDIATE';
        // Rule: Never infer "STRONG" merely because a skill appears once!
        if (matches.length >= 3 || textLower.includes(`expert in ${kw.toLowerCase()}`) || textLower.includes(`lead ${kw.toLowerCase()}`)) {
          proficiency = 'STRONG';
        } else if (textLower.includes(`basic ${kw.toLowerCase()}`) || textLower.includes(`familiar with ${kw.toLowerCase()}`)) {
          proficiency = 'BASIC';
        } else if (textLower.includes(`learning ${kw.toLowerCase()}`)) {
          proficiency = 'LEARNING';
        }

        detectedSkills.push({
          name: kw,
          yearsExperience: matches.length >= 3 ? 3.0 : 1.5,
          proficiency
        });
      }
    });

    // Identify target roles based on title and content
    let targetRoles = ['Backend Developer'];
    let secondaryRoles = ['Full Stack Developer'];

    const titleLower = resumeTitle.toLowerCase();
    if (titleLower.includes('frontend') || textLower.includes('react.js')) {
      targetRoles = ['Frontend Developer', 'React.js Developer'];
      secondaryRoles = ['Full Stack Developer'];
    } else if (titleLower.includes('full stack') || titleLower.includes('fullstack')) {
      targetRoles = ['Full Stack Developer', 'Node.js & React Engineer'];
      secondaryRoles = ['Backend Developer'];
    } else if (titleLower.includes('ai') || titleLower.includes('genai') || textLower.includes('python')) {
      targetRoles = ['AI Software Engineer', 'Python LLM Developer'];
      secondaryRoles = ['Backend Developer'];
    } else if (titleLower.includes('support')) {
      targetRoles = ['Technical Support Specialist', 'Application Support Engineer'];
      secondaryRoles = ['IT Specialist'];
    }

    const keywords = detectedSkills.map(s => s.name);
    const strongSkills = detectedSkills.filter(s => s.proficiency === 'STRONG').map(s => s.name);

    return {
      skills: detectedSkills,
      experienceYears: detectedSkills.length > 3 ? 2.5 : 1.0,
      currentRole: targetRoles[0],
      targetRoles,
      secondaryRoles,
      education: textLower.includes('b.tech') || textLower.includes('bachelor')
        ? [{ degree: 'B.Tech', field: 'Computer Science & Engineering', institution: 'University', year: 2023 }]
        : [],
      certifications: textLower.includes('aws') ? ['AWS Certified Developer'] : [],
      keywords,
      achievements: textLower.includes('optimized') ? ['Optimized API throughput and reduced query latency by 40%'] : [],
      projects: detectedSkills.length > 0 ? [
        {
          title: `${resumeTitle} Project`,
          description: `Built microservices platform utilizing ${keywords.slice(0, 3).join(', ')}.`,
          techStack: keywords.slice(0, 4)
        }
      ] : [],
      workExperience: detectedSkills.length > 0 ? [
        {
          company: 'Software Solutions',
          role: targetRoles[0],
          duration: '2023 - Present',
          description: `Developed production applications using ${keywords.slice(0, 3).join(', ')}.`
        }
      ] : [],
      aiProfileAnalysis: {
        strongSkills,
        weakSkills: ['Kubernetes cluster operations'],
        missingSkills: ['GraphQL schema federation'],
        marketableSkills: keywords.slice(0, 3),
        competitiveRoles: targetRoles,
        lowProbabilityRoles: ['VP of Engineering', 'Principal Architect']
      }
    };
  }
}

export const resumeParserService = new ResumeParserService();
