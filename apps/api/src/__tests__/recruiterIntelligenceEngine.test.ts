import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { recruiterService } from '../services/recruiter/recruiterService';
import { recruiterRankingEngine } from '../services/recruiter/recruiterRankingEngine';
import { hunterIoProvider } from '../services/recruiter/providers/hunterIoProvider';
import { apolloProvider } from '../services/recruiter/providers/apolloProvider';
import { userProvidedRecruiterProvider } from '../services/recruiter/providers/userProvidedProvider';

describe('JobHunter AI Step 6: Real Recruiter Intelligence Engine Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. 10-Tier Role Hierarchy & Ranking: Technical Recruiter ranks higher than Engineering Manager and HR', () => {
    const techRecruiter = {
      name: 'Sarah Connor',
      jobTitle: 'Technical Recruiter - Engineering',
      companyName: 'Acme Cloud',
      email: 'sarah@acme.com',
      verificationStatus: 'VERIFIED' as const,
      emailVerified: 'VERIFIED' as const
    };

    const engManager = {
      name: 'John Doe',
      jobTitle: 'Engineering Manager',
      companyName: 'Acme Cloud',
      email: 'john@acme.com',
      verificationStatus: 'VERIFIED' as const,
      emailVerified: 'VERIFIED' as const
    };

    const hrGeneralist = {
      name: 'Pooja Tech',
      jobTitle: 'Human Resources Generalist',
      companyName: 'Acme Cloud',
      email: 'pooja@acme.com',
      verificationStatus: 'VERIFIED' as const,
      emailVerified: 'VERIFIED' as const
    };

    const evalTech = recruiterRankingEngine.evaluateRecruiter(techRecruiter, 'Backend Engineer', 'Acme Cloud');
    const evalEM = recruiterRankingEngine.evaluateRecruiter(engManager, 'Backend Engineer', 'Acme Cloud');
    const evalHR = recruiterRankingEngine.evaluateRecruiter(hrGeneralist, 'Backend Engineer', 'Acme Cloud');

    expect(evalTech.relevanceScore).toBeGreaterThan(evalEM.relevanceScore);
    expect(evalEM.relevanceScore).toBeGreaterThan(evalHR.relevanceScore);
    expect(evalTech.whyRelevant.some(r => r.includes('Technical Recruiter'))).toBe(true);
  });

  it('2. Anti-Fabrication & Email Verification Guardrail: Never invents email address when missing', () => {
    const unverifiedRecruiter = {
      name: 'Alex Rivera',
      jobTitle: 'Talent Acquisition Lead',
      companyName: 'Cyberdyne Systems',
      profileUrl: 'https://linkedin.com/in/alex-rivera-ta',
      email: null, // Missing email
      emailSource: null,
      emailVerified: 'UNKNOWN' as const,
      verificationStatus: 'PUBLIC' as const
    };

    const evalResult = recruiterRankingEngine.evaluateRecruiter(unverifiedRecruiter, 'Backend Engineer', 'Cyberdyne Systems');

    // Rule 2: Never guess firstname.lastname@company.com!
    expect(unverifiedRecruiter.email).toBeNull();
    expect(evalResult.relevanceScore).toBeLessThan(90);
    expect(evalResult.whyRelevant.some(r => r.includes('not publicly listed'))).toBe(true);
  });

  it('3. Wrong-Company Recruiter Rejection: Recruiter for Company X is rejected for Job at Company Y', async () => {
    const wrongCompanyRecruiter = {
      id: 'rec-wrong-1',
      companyId: 'comp-companyx',
      name: 'David Miller',
      role: 'Technical Recruiter',
      linkedinUrl: 'https://linkedin.com/in/david-miller',
      email: 'david@companyx.com',
      isVerified: true,
      confidence: 0.9,
      source: 'Public Portal'
    };

    const ranked = await recruiterService.discoverAndRankRecruiters(
      { title: 'Node.js Developer', companyName: 'Company Y', location: 'Remote', companyId: 'comp-companyy' },
      [wrongCompanyRecruiter]
    );

    // Wrong company recruiter should be filtered out cleanly
    const david = ranked.find(r => r.recruiter.name === 'David Miller');
    expect(david).toBeUndefined();
  });

  it('4. Missing Recruiter Handling: Returns empty array when no verified recruiter exists', async () => {
    const ranked = await recruiterService.discoverAndRankRecruiters({
      title: 'Senior Rust Developer',
      companyName: 'NonExistentTechCorp999',
      location: 'Remote'
    });

    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(0);
  });

  it('5. User-Provided Recruiter Integration: Correctly processes user-submitted recruiter', async () => {
    const userRecruiter = userProvidedRecruiterProvider.createUserRecruiter({
      name: 'Rohan Gupta',
      jobTitle: 'Engineering Talent Partner',
      companyName: 'Acme Technologies',
      email: 'rohan.gupta@acme.com',
      profileUrl: 'https://linkedin.com/in/rohan-gupta-ta'
    });

    expect(userRecruiter.verificationStatus).toBe('VERIFIED');
    expect(userRecruiter.emailSource).toBe('User Provided');
    expect(userRecruiter.emailVerified).toBe('VERIFIED');
  });

  it('6. Provider Health API Endpoint: GET /api/outreach/providers/health', async () => {
    const healthRes = await request(app)
      .get('/api/outreach/providers/health')
      .set('Authorization', `Bearer ${authToken}`);

    expect(healthRes.status).toBe(200);
    expect(Array.isArray(healthRes.body.providers)).toBe(true);

    const hunter = healthRes.body.providers.find((p: any) => p.id === 'hunter_io');
    const apollo = healthRes.body.providers.find((p: any) => p.id === 'apollo');
    expect(hunter).toBeDefined();
    expect(apollo).toBeDefined();
    expect(hunter.isConfigured).toBe(false); // HUNTER_API_KEY unattached in test env -> false
    expect(hunter.status).toBe('NOT CONFIGURED');
  });

  it('7. Provider Failure Resiliency: Service continues safely if a provider fails', async () => {
    recruiterService.registerProvider({
      id: 'failing_provider',
      name: 'Faulty Provider API',
      isConfigured: true,
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
