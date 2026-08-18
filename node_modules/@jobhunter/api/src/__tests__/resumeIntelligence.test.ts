import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { resumeParserService } from '../services/resume/resumeParser';
import { multiResumeMatcher } from '../services/resume/multiResumeMatcher';
import { JobDTO, RemotePreference, ResumeDTO } from '@jobhunter/types';

describe('JobHunter AI Step 3: Candidate & Multi-Resume Intelligence Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    memoryStore.resumes.clear();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Heuristic & AI Parser: Extracts exact skill proficiencies (STRONG vs INTERMEDIATE vs BASIC)', () => {
    const rawText = `Candidate Profile: Expert in Node.js with 4 years lead experience. Lead Node.js architect. Node.js microservices. Also familiar with Python and basic Docker.`;
    const parsed = resumeParserService.heuristicFallbackParse(rawText, 'Backend Resume');

    const nodeSkill = parsed.skills.find(s => s.name.toLowerCase() === 'node.js');
    const pythonSkill = parsed.skills.find(s => s.name.toLowerCase() === 'python');
    const dockerSkill = parsed.skills.find(s => s.name.toLowerCase() === 'docker');

    expect(nodeSkill).toBeDefined();
    // Rule: Must be STRONG because it appears 3+ times with 'lead'
    expect(nodeSkill?.proficiency).toBe('STRONG');

    expect(pythonSkill).toBeDefined();
    // Rule: Must NOT be STRONG because it appears only once without lead/expert context
    expect(pythonSkill?.proficiency).not.toBe('STRONG');

    expect(dockerSkill).toBeDefined();
    expect(dockerSkill?.proficiency).toBe('BASIC');
  });

  it('2. Multi-Resume Support: Candidate uploads multiple resume versions (Backend, Full Stack, Frontend)', async () => {
    // 1. Upload Backend Resume
    const res1 = await request(app)
      .post('/api/profile/resumes/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Backend Node.js & Database Resume',
        targetRole: 'Backend Developer',
        version: 'v1.0',
        rawText: 'Backend Developer specializing in Node.js, Express, REST APIs, PostgreSQL, Redis, and SQL optimization.'
      });
    expect(res1.status).toBe(201);
    expect(res1.body.resume.targetRole).toBe('Backend Developer');

    // 2. Upload Full Stack Resume
    const res2 = await request(app)
      .post('/api/profile/resumes/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Full Stack Node.js & React Resume',
        targetRole: 'Full Stack Developer',
        version: 'v1.2',
        rawText: 'Full Stack Engineer with expertise in Node.js, React.js, TypeScript, PostgreSQL, and Tailwind CSS.'
      });
    expect(res2.status).toBe(201);

    // 3. Upload Frontend Resume
    const res3 = await request(app)
      .post('/api/profile/resumes/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Frontend React UI Resume',
        targetRole: 'Frontend Developer',
        version: 'v2.0',
        rawText: 'Frontend Developer with React.js, Redux, HTML5, CSS3, Tailwind, and Webpack.'
      });
    expect(res3.status).toBe(201);

    // Fetch all resumes
    const listRes = await request(app)
      .get('/api/profile/resumes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.body.length).toBe(3);
  });

  it('3. Duplicate Resume Upload: Updates existing resume entry instead of duplicating', async () => {
    const dupeRes = await request(app)
      .post('/api/profile/resumes/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Backend Node.js & Database Resume',
        targetRole: 'Backend Developer',
        rawText: 'Updated Backend Developer resume content with Docker & Redis.'
      });

    expect(dupeRes.status).toBe(200);
    expect(dupeRes.body.message).toContain('updated');

    const listRes = await request(app)
      .get('/api/profile/resumes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.body.length).toBe(3); // Count remains 3
  });

  it('4. Multi-Resume Job Matching: Evaluates all resumes for a Backend job and recommends Backend Resume', () => {
    const resumes: ResumeDTO[] = [
      {
        id: 'res-1',
        userId: 'demo-user-123',
        title: 'Backend Node.js & Database Resume',
        targetRole: 'Backend Developer',
        fileUrl: '/resumes/backend.pdf',
        fileType: 'pdf',
        skills: ['Node.js', 'Express', 'SQL', 'PostgreSQL', 'Redis'],
        keywords: ['microservices', 'REST API', 'SQL'],
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'res-2',
        userId: 'demo-user-123',
        title: 'Full Stack Node.js & React Resume',
        targetRole: 'Full Stack Developer',
        fileUrl: '/resumes/fullstack.pdf',
        fileType: 'pdf',
        skills: ['Node.js', 'React.js', 'TypeScript', 'PostgreSQL'],
        keywords: ['frontend', 'backend', 'fullstack'],
        isDefault: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'res-3',
        userId: 'demo-user-123',
        title: 'Frontend React UI Resume',
        targetRole: 'Frontend Developer',
        fileUrl: '/resumes/frontend.pdf',
        fileType: 'pdf',
        skills: ['React.js', 'Redux', 'HTML', 'CSS', 'Tailwind'],
        keywords: ['UI', 'UX', 'React'],
        isDefault: false,
        createdAt: new Date().toISOString()
      }
    ];

    const backendJob: JobDTO = {
      id: 'job-be-99',
      title: 'Backend Developer (Node.js & Microservices)',
      companyId: 'comp-acme',
      companyName: 'Acme Cloud',
      source: 'Naukri',
      canonicalUrl: 'https://acme.com/jobs/99',
      applicationUrl: 'https://acme.com/jobs/99/apply',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Need Backend Developer with Node.js, Express, SQL, Redis.',
      requiredSkills: ['Node.js', 'Express', 'SQL', 'Redis'],
      preferredSkills: ['PostgreSQL'],
      postedAt: new Date().toISOString()
    };

    const evalResult = multiResumeMatcher.evaluateResumesForJob(resumes, backendJob);

    expect(evalResult.bestMatch).toBeDefined();
    expect(evalResult.bestMatch?.resumeTitle).toBe('Backend Node.js & Database Resume');
    expect(evalResult.bestMatch?.isRecommended).toBe(true);
    expect(evalResult.allMatches.length).toBe(3);

    // Verify ordering: Backend > Full Stack > Frontend
    expect(evalResult.allMatches[0].matchScore).toBeGreaterThan(evalResult.allMatches[1].matchScore);
    expect(evalResult.allMatches[1].matchScore).toBeGreaterThan(evalResult.allMatches[2].matchScore);
  });

  it('5. Malformed/Empty Text Handling: Parser returns clean empty data without throwing or hallucinating', async () => {
    const parsedEmpty = await resumeParserService.parseResumeText('', 'Empty Resume');

    expect(parsedEmpty.skills).toEqual([]);
    expect(parsedEmpty.experienceYears).toBe(0);
    expect(parsedEmpty.projects).toEqual([]);
    expect(parsedEmpty.workExperience).toEqual([]);
  });
});
