import { aiManager } from '../ai/aiProvider';
import { SkillProficiencyLevel } from '@jobhunter/types';
import { normalizeSkillName } from '../skill/skillNormalizationService';

export interface ExtractedSkillWithConfidence {
  name: string;
  normalizedName: string;
  yearsExperience: number;
  proficiency: SkillProficiencyLevel;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: 'resume' | 'work_experience' | 'project' | 'certification' | 'user_entered';
  isProfessionalExperience: boolean;
}

export interface ParsedResumeResult {
  skills: ExtractedSkillWithConfidence[];
  experienceYears: number;
  currentRole: string;
  targetRoles: string[];
  secondaryRoles: string[];
  education: Array<{ degree: string; field?: string; institution?: string; year?: number; educationLevel?: string }>;
  certifications: Array<{ name: string; issuingOrganization?: string; issueDate?: string; expiryDate?: string }>;
  keywords: string[];
  achievements: string[];
  projects: Array<{ title: string; description?: string; techStack: string[]; githubUrl?: string; liveUrl?: string }>;
  workExperience: Array<{ company: string; role: string; duration?: string; description?: string; technologies?: string[] }>;
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
      return this.emptyResult();
    }

    const systemPrompt = `You are a Senior Tech Recruiter and AI Resume Intelligence Specialist.
Analyze the candidate's raw resume text and output a JSON object containing:
- skills: array of objects { name, yearsExperience, proficiency, confidence, evidence, isProfessionalExperience } where:
  * proficiency MUST be one of ["STRONG", "INTERMEDIATE", "BASIC", "LEARNING"]. Never infer "STRONG" unless candidate demonstrates multi-year commercial usage or leadership.
  * confidence MUST be one of ["HIGH", "MEDIUM", "LOW"].
  * evidence MUST be one of ["resume", "work_experience", "project", "certification"].
  * isProfessionalExperience: boolean (false if skill only used in personal projects).
- experienceYears: number (0 if no explicit commercial work experience duration)
- currentRole: string ("UNKNOWN" if unavailable)
- targetRoles: string[] (empty [] if unavailable)
- secondaryRoles: string[]
- education: array of objects { degree, field, institution, year, educationLevel }
- certifications: array of objects { name, issuingOrganization, issueDate, expiryDate } (empty [] if unavailable)
- keywords: string[]
- achievements: string[] (empty [] if unavailable)
- projects: array of objects { title, description, techStack, githubUrl, liveUrl } (empty [] if unavailable)
- workExperience: array of objects { company, role, duration, description, technologies } (empty [] if unavailable)
- aiProfileAnalysis: { strongSkills, weakSkills, missingSkills, marketableSkills, competitiveRoles, lowProbabilityRoles }

CRITICAL RULE: NEVER invent, hallucinate, or fabricate experience, companies, certifications, achievements, dates, or projects not present in the text. Return ONLY valid JSON.`;

    const userPrompt = `Resume Title: ${resumeTitle}\n\nResume Content:\n${rawText}`;

    const parsed = await aiManager.completeJSON<ParsedResumeResult>(
      systemPrompt, 
      userPrompt, 
      () => this.heuristicFallbackParse(rawText, resumeTitle)
    );

    // Normalize all skill names
    parsed.skills = (parsed.skills || []).map(s => ({
      ...s,
      normalizedName: normalizeSkillName(s.name)
    }));

    return parsed;
  }

  private emptyResult(): ParsedResumeResult {
    return {
      skills: [],
      experienceYears: 0,
      currentRole: 'UNKNOWN',
      targetRoles: [],
      secondaryRoles: [],
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
      return this.emptyResult();
    }

    const textLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const textLower = rawText.toLowerCase();

    // Section Segmentation
    let currentSection = 'general';
    const sections: Record<string, string[]> = {
      general: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      achievements: [],
      skills: []
    };

    textLines.forEach(line => {
      const lineLower = line.toLowerCase();
      if (/^(work\s+experience|experience|employment|work\s+history)\b/i.test(lineLower)) {
        currentSection = 'experience';
      } else if (/^(projects?|personal\s+projects?|portfolio)\b/i.test(lineLower)) {
        currentSection = 'projects';
      } else if (/^(education|academic|qualification)\b/i.test(lineLower)) {
        currentSection = 'education';
      } else if (/^(certifications?|licenses?|courses?)\b/i.test(lineLower)) {
        currentSection = 'certifications';
      } else if (/^(achievements?|honors?|awards?)\b/i.test(lineLower)) {
        currentSection = 'achievements';
      } else if (/^(skills?|technical\s+skills?|core\s+competencies)\b/i.test(lineLower)) {
        currentSection = 'skills';
      } else {
        sections[currentSection].push(line);
      }
    });

    const expText = sections.experience.join('\n').toLowerCase();
    const projText = sections.projects.join('\n').toLowerCase();

    // 1. Skill Extraction & Evidence Disambiguation
    const techKeywords = [
      'Node.js', 'Express', 'React', 'JavaScript', 'TypeScript', 'MongoDB', 'PostgreSQL',
      'SQL', 'Python', 'REST API', 'Docker', 'AWS', 'HTML', 'CSS', 'Redux', 'Git', 'Java', 'C++', 'GraphQL'
    ];

    const detectedSkills: ExtractedSkillWithConfidence[] = [];

    techKeywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      const matches = textLower.match(regex);

      if (matches && matches.length > 0) {
        const inExp = expText.length > 0 && new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi').test(expText);
        const inProj = projText.length > 0 && new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi').test(projText);

        let proficiency: SkillProficiencyLevel = 'INTERMEDIATE';
        // Rule: Never infer "STRONG" merely because a skill appears once!
        if (matches.length >= 3 || textLower.includes(`expert in ${kw.toLowerCase()}`) || textLower.includes(`lead ${kw.toLowerCase()}`)) {
          proficiency = 'STRONG';
        } else if (textLower.includes(`basic ${kw.toLowerCase()}`) || textLower.includes(`familiar with ${kw.toLowerCase()}`)) {
          proficiency = 'BASIC';
        } else if (textLower.includes(`learning ${kw.toLowerCase()}`)) {
          proficiency = 'LEARNING';
        }

        const evidence = inExp ? 'work_experience' : inProj ? 'project' : 'resume';
        const isProfessionalExperience = inExp;

        detectedSkills.push({
          name: kw,
          normalizedName: normalizeSkillName(kw),
          yearsExperience: inExp ? (matches.length >= 3 ? 3.0 : 1.5) : 0,
          proficiency,
          confidence: matches.length >= 2 ? 'HIGH' : 'MEDIUM',
          evidence,
          isProfessionalExperience
        });
      }
    });

    // 2. Strict Labeled Projects Extraction (ZERO Hallucination)
    const projects: Array<{ title: string; description?: string; techStack: string[] }> = [];
    sections.projects.forEach(line => {
      if (line.length > 2 && !line.toLowerCase().startsWith('project:')) {
        const matchedTech = detectedSkills.map(s => s.normalizedName).slice(0, 3);
        projects.push({
          title: line.replace(/^[-•*]\s*/, ''),
          techStack: matchedTech
        });
      } else if (line.toLowerCase().startsWith('project:')) {
        const title = line.replace(/^project:\s*/i, '').trim();
        if (title.length > 0) {
          const matchedTech = detectedSkills.map(s => s.normalizedName).slice(0, 3);
          projects.push({
            title,
            techStack: matchedTech
          });
        }
      }
    });

    // 3. Strict Labeled Work Experience Extraction (ZERO Hallucination)
    const workExperience: Array<{ company: string; role: string; duration?: string; description?: string }> = [];
    sections.experience.forEach(line => {
      if (line.includes(' at ') || line.includes(' - ') || line.includes('|')) {
        const parts = line.split(/ at | - |\|/);
        if (parts.length >= 2) {
          workExperience.push({
            role: parts[0].trim(),
            company: parts[1].trim(),
            description: line
          });
        }
      }
    });

    // 4. Strict Labeled Education Extraction (ZERO Hallucination)
    const education: Array<{ degree: string; field?: string; institution?: string; year?: number }> = [];
    sections.education.forEach(line => {
      const lineLower = line.toLowerCase();
      if (lineLower.includes('b.tech') || lineLower.includes('bachelor') || lineLower.includes('m.tech') || lineLower.includes('master') || lineLower.includes('b.s')) {
        let degree = 'Bachelor';
        if (lineLower.includes('b.tech')) degree = 'B.Tech';
        else if (lineLower.includes('m.tech')) degree = 'M.Tech';
        else if (lineLower.includes('b.s')) degree = 'B.S.';

        education.push({
          degree,
          field: lineLower.includes('computer science') ? 'Computer Science' : undefined,
          institution: lineLower.includes('college') || lineLower.includes('university') ? line : undefined
        });
      }
    });

    // 5. Strict Labeled Certifications Extraction (ZERO Hallucination)
    const certifications: Array<{ name: string; issuingOrganization?: string }> = [];
    sections.certifications.forEach(line => {
      if (line.length > 3) {
        certifications.push({
          name: line.replace(/^[-•*]\s*/, '')
        });
      }
    });

    // 6. Strict Labeled Achievements Extraction (ZERO Hallucination)
    const achievements: string[] = [];
    sections.achievements.forEach(line => {
      if (line.length > 3) {
        achievements.push(line.replace(/^[-•*]\s*/, ''));
      }
    });

    // 7. Target Roles from title/headers only
    const targetRoles: string[] = [];
    const titleLower = resumeTitle.toLowerCase();
    if (titleLower.includes('backend')) targetRoles.push('Backend Developer');
    if (titleLower.includes('frontend')) targetRoles.push('Frontend Developer');
    if (titleLower.includes('full stack') || titleLower.includes('fullstack')) targetRoles.push('Full Stack Developer');
    if (titleLower.includes('ai') || titleLower.includes('genai')) targetRoles.push('AI Software Engineer');

    const keywords = detectedSkills.map(s => s.normalizedName);
    const strongSkills = detectedSkills.filter(s => s.proficiency === 'STRONG').map(s => s.normalizedName);

    return {
      skills: detectedSkills,
      experienceYears: workExperience.length > 0 ? workExperience.length * 1.5 : 0,
      currentRole: workExperience[0]?.role || targetRoles[0] || 'UNKNOWN',
      targetRoles,
      secondaryRoles: [],
      education,
      certifications,
      keywords,
      achievements,
      projects,
      workExperience,
      aiProfileAnalysis: {
        strongSkills,
        weakSkills: [],
        missingSkills: [],
        marketableSkills: keywords.slice(0, 3),
        competitiveRoles: targetRoles,
        lowProbabilityRoles: []
      }
    };
  }
}

export const resumeParserService = new ResumeParserService();
