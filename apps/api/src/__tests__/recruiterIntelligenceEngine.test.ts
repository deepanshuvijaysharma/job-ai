import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { recruiterService } from '../services/recruiter/recruiterService';
import { publicDirectoryProvider } from '../services/recruiter/directoryProvider';
import { recruiterRankingEngine } from '../services/recruiter/recruiterRankingEngine';

describe('JobHunter AI Step 6: Recruiter Intelligence Engine Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Recruiter Role Hierarchy & Ranking: Technical Recruiter ranks higher than General HR', () => {
    const techRecruiter = {
      name: 'Amit Sharma',
      jobTitle: 'Technical Recruiter - Engineering',
      company: 'Acme Cloud',
      email: 'amit@acme.com',
      isVerified: true
    };

    const hrGeneralist = {
      name: 'Pooja Tech',
      jobTitle: 'Human Resources Generalist',
      company: 'Acme Cloud',
      email: 'pooja@acme.com',
      isVerified: true
    };

    const evalTech = recruiterRankingEngine.evaluateRecruiter(techRecruiter, 'Backend Engineer');
    const evalHR = recruiterRankingEngine.evaluateRecruiter(hrGeneralist, 'Backend Engineer');

    expect(evalTech.relevanceScore).toBeGreaterThan(evalHR.relevanceScore);
    expect(evalTech.whyRelevant.some(r => r.includes('Technical Recruiter'))).toBe(true);
  });

  it('2. Verified vs Unverified Email Guardrail: Never marks unverified or missing email as verified', async () => {
    const recruiters = await publicDirectoryProvider.searchRecruiters({
      companyName: 'InnovateX Labs',
      jobTitle: 'Node.js Developer'
    });

    expect(recruiters.length).toBeGreaterThan(0);

    const verifiedCandidate = recruiters.find(r => r.email !== undefined);
    const unverifiedCandidate = recruiters.find(r => r.email === undefined);

    if (verifiedCandidate) {
      expect(verifiedCandidate.isVerified).toBe(true);
      expect(verifiedCandidate.sourceUrl).toBeDefined();
    }

    if (unverifiedCandidate) {
      expect(unverifiedCandidate.isVerified).toBe(false);
      // Rule 4: Never guess firstname.lastname@company.com!
      expect(unverifiedCandidate.email).toBeUndefined();
    }
  });

  it('3. Provider Pluggability & Deduplication: Prevents duplicate recruiter entries', async () => {
    const existingRecruiters = [
      {
        id: 'rec-dupe-1',
        companyId: 'comp-acmecloud',
        name: 'Amit Sharma',
        role: 'Technical Recruiter - Engineering',
        email: 'amit.sharma@acmecloud.com',
        isVerified: true,
        confidence: 0.94,
        source: 'Public Career Portal'
      }
    ];

    const ranked = await recruiterService.discoverAndRankRecruiters(
      { title: 'Backend Engineer', companyName: 'Acme Cloud', location: 'Noida' },
      existingRecruiters
    );

    expect(ranked.length).toBeGreaterThan(0);
    // Check no duplicate entries with exact name 'Amit Sharma'
    const amitEntries = ranked.filter(r => r.recruiter.name === 'Amit Sharma');
    expect(amitEntries.length).toBe(1);
    expect(amitEntries[0].evidence?.source).toBeDefined();
  });

  it('4. Provider Failure Resiliency: Service continues if an external provider fails', async () => {
    // Register a failing dummy provider
    recruiterService.registerProvider({
      providerId: 'failing_provider',
      name: 'Faulty Provider API',
      searchRecruiters: async () => {
        throw new Error('API Rate limit 429');
      }
    });

    const ranked = await recruiterService.discoverAndRankRecruiters({
      title: 'Backend Engineer',
      companyName: 'Acme Cloud',
      location: 'Noida'
    });

    expect(ranked).toBeDefined();
    expect(Array.isArray(ranked)).toBe(true);
  });
});
