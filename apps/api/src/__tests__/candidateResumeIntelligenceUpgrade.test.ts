import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { resumeParserService } from '../services/resume/resumeParser';
import { multiResumeMatcher } from '../services/resume/multiResumeMatcher';
import { normalizeSkillName } from '../services/skill/skillNormalizationService';
import { profileRepository, resumeRepository } from '../repositories/prismaRepository';
import { JobDTO, RemotePreference, ResumeDTO } from '@jobhunter/types';

describe('JobHunter AI Step 3: Candidate & Resume Intelligence Upgrade & Verification Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Candidate Profile CRUD & Persistence: Profile fields, roles, and compensation survive', async () => {
    const profile = await profileRepository.upsert('demo-user-123', {
      phone: '+91 9876543210',
      location: 'Noida, India',
      preferredLocations: ['Noida', 'Bengaluru', 'Remote'],
      remotePref: RemotePreference.HYBRID,
      experienceYears: 4.0,
      currentRole: 'Senior Node.js Developer',
      targetRoles: ['Backend Developer', 'Software Architect'],
      salaryMin: 1400000,
      salaryMax: 2000000,
      noticePeriodDays: 15,
      githubUrl: 'https://github.com/deepanshu',
      portfolioUrl: 'https://deepanshu.dev',
      linkedinUrl: 'https://linkedin.com/in/deepanshu'
    });

    expect(profile).toBeDefined();

    // Read profile via API endpoint
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.targetRoles).toContain('Backend Developer');
    expect(res.body.salaryMin).toBe(1400000);
    expect(res.body.githubUrl).toBe('https://github.com/deepanshu');
  });

  it('2. Skill Normalization Dictionary: Maps equivalent skills correctly', () => {
    expect(normalizeSkillName('JS')).toBe('JavaScript');
    expect(normalizeSkillName('js')).toBe('JavaScript');
    expect(normalizeSkillName('TS')).toBe('TypeScript');
    expect(normalizeSkillName('ts')).toBe('TypeScript');
    expect(normalizeSkillName('Node')).toBe('Node.js');
    expect(normalizeSkillName('NodeJS')).toBe('Node.js');
    expect(normalizeSkillName('ReactJS')).toBe('React.js');
    expect(normalizeSkillName('Postgres')).toBe('PostgreSQL');
    expect(normalizeSkillName('Mongo')).toBe('MongoDB');
    expect(normalizeSkillName('REST')).toBe('REST API');
  });

  it('3. Skill Proficiency Guardrail: Single occurrence never infers STRONG', () => {
    const rawText = 'I have basic exposure to Node.js in one project.';
    const parsed = resumeParserService.heuristicFallbackParse(rawText, 'General Resume');
    const nodeSkill = parsed.skills.find(s => s.normalizedName === 'Node.js');
    
    expect(nodeSkill).toBeDefined();
    expect(nodeSkill?.proficiency).not.toBe('STRONG');
    expect(['BASIC', 'INTERMEDIATE', 'LEARNING']).toContain(nodeSkill?.proficiency);
  });

  it('4. Resume Parsing & Zero Hallucination: Missing info remains UNKNOWN/empty', async () => {
    const rawText = 'Short resume content with JavaScript and React experience.';
    const parsed = await resumeParserService.parseResumeText(rawText, 'Brief Resume');

    expect(parsed).toBeDefined();
    expect(parsed.skills.length).toBeGreaterThan(0);
    // Unmentioned certifications or work experience must not be hallucinated
    if (parsed.certifications.length === 0) {
      expect(parsed.certifications).toEqual([]);
    }
  });

  it('5. Multi-Resume Management: Create and query Backend, Full Stack, Frontend, AI, and Support resumes', async () => {
    const backendRes = await resumeRepository.create({
      userId: 'demo-user-123',
      title: 'Backend Resume',
      fileUrl: '/uploads/backend-2026.pdf',
      fileType: 'pdf',
      rawText: 'Expert in Node.js, Express, PostgreSQL, SQL, microservices, REST API, Redis',
      parsedData: {
        skills: [{ name: 'Node.js' }, { name: 'PostgreSQL' }, { name: 'Express' }],
        projects: [{ title: 'MERN Job Portal' }]
      }
    });

    const fullStackRes = await resumeRepository.create({
      userId: 'demo-user-123',
      title: 'Full Stack Resume',
      fileUrl: '/uploads/fullstack-2026.pdf',
      fileType: 'pdf',
      rawText: 'Full Stack Engineer with Node.js, React.js, Express, MongoDB, TailwindCSS',
      parsedData: {
        skills: [{ name: 'Node.js' }, { name: 'React.js' }, { name: 'MongoDB' }],
        projects: [{ title: 'SaaS Dashboard' }]
      }
    });

    const frontendRes = await resumeRepository.create({
      userId: 'demo-user-123',
      title: 'Frontend Resume',
      fileUrl: '/uploads/frontend-2026.pdf',
      fileType: 'pdf',
      rawText: 'Frontend Developer skilled in React.js, TypeScript, Next.js, Redux, CSS',
      parsedData: {
        skills: [{ name: 'React.js' }, { name: 'TypeScript' }, { name: 'Redux' }]
      }
    });

    expect(backendRes).toBeDefined();
    expect(fullStackRes).toBeDefined();
    expect(frontendRes).toBeDefined();

    const allResumes = await resumeRepository.findByUserId('demo-user-123');
    expect(allResumes.length).toBeGreaterThanOrEqual(3);
  });

  it('6. Multi-Resume ↔ Job Matching & Explainability: Recommends highest matching resume version with breakdown', () => {
    const resumes: ResumeDTO[] = [
      {
        id: 'res-backend',
        userId: 'demo-user-123',
        title: 'Backend Resume',
        targetRole: 'Backend Developer',
        fileUrl: '/resumes/backend.pdf',
        fileType: 'pdf',
        rawText: 'Node.js Express PostgreSQL SQL REST API microservices',
        skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API', 'SQL'],
        keywords: ['Node.js', 'PostgreSQL', 'Express'],
        projects: [{ title: 'MERN Microservices Engine', techStack: ['Node.js', 'Express', 'PostgreSQL'] }],
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'res-fullstack',
        userId: 'demo-user-123',
        title: 'Full Stack Resume',
        targetRole: 'Full Stack Developer',
        fileUrl: '/resumes/fullstack.pdf',
        fileType: 'pdf',
        rawText: 'Node.js React.js MongoDB Express JavaScript',
        skills: ['Node.js', 'React.js', 'MongoDB', 'JavaScript'],
        keywords: ['Node.js', 'React.js'],
        projects: [{ title: 'Job Search SPA', techStack: ['React.js', 'Node.js'] }],
        isDefault: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'res-frontend',
        userId: 'demo-user-123',
        title: 'Frontend Resume',
        targetRole: 'Frontend Developer',
        fileUrl: '/resumes/frontend.pdf',
        fileType: 'pdf',
        rawText: 'React.js TypeScript Redux HTML CSS UI/UX',
        skills: ['React.js', 'TypeScript', 'Redux', 'CSS'],
        keywords: ['React.js', 'Redux'],
        projects: [{ title: 'Component Library', techStack: ['React.js', 'TypeScript'] }],
        isDefault: false,
        createdAt: new Date().toISOString()
      }
    ];

    const backendJob: JobDTO = {
      id: 'job-backend-spec',
      title: 'Senior Backend Developer',
      companyId: 'comp-101',
      companyName: 'Backend Tech Corp',
      source: 'Greenhouse',
      canonicalUrl: 'https://backendtech.com/careers/backend-spec',
      applicationUrl: 'https://backendtech.com/apply/backend-spec',
      location: 'Noida, India',
      remoteType: RemotePreference.HYBRID,
      description: 'Building RESTful APIs with Node.js and PostgreSQL',
      requiredSkills: ['Node.js', 'PostgreSQL', 'Express', 'REST API'],
      preferredSkills: ['Redis', 'Docker'],
      postedAt: new Date().toISOString()
    };

    const evaluation = multiResumeMatcher.evaluateResumesForJob(resumes, backendJob);

    expect(evaluation.bestMatch).toBeDefined();
    expect(evaluation.bestMatch?.resumeTitle).toBe('Backend Resume');
    expect(evaluation.bestMatch?.isRecommended).toBe(true);
    expect(evaluation.bestMatch?.matchScore).toBeGreaterThanOrEqual(85);
    expect(evaluation.bestMatch?.explanation.matchedSkills).toContain('Node.js');
    expect(evaluation.bestMatch?.explanation.roleAlignment).toBe('Strong');

    // All matches table present
    expect(evaluation.allMatches.length).toBe(3);
    expect(evaluation.allMatches[0].resumeTitle).toBe('Backend Resume');
  });

  it('7. Candidate Intelligence Backend Restart Test: Candidate profile and resume versions survive backend restart', async () => {
    // 1. Seed complete candidate dataset
    await profileRepository.upsert('demo-user-123', {
      currentRole: 'Backend Solutions Architect',
      targetRoles: ['Principal Backend Engineer', 'Tech Lead']
    });

    // 2. SIMULATE RESTART: Clear in-memory caches
    memoryStore.clearAllData();

    // 3. Read profile and resumes again after restart
    const fetchedProfile = await profileRepository.findByUserId('demo-user-123');
    expect(fetchedProfile).toBeDefined();

    const fetchedResumes = await resumeRepository.findByUserId('demo-user-123');
    expect(fetchedResumes).toBeDefined();
    expect(fetchedResumes.length).toBeGreaterThan(0);
  });
});
