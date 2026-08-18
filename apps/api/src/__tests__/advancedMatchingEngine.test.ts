import { advancedMatchingEngine } from '../services/job/advancedMatchingEngine';
import { RemotePreference } from '@jobhunter/types';

describe('JobHunter AI Step 4: Advanced Job Matching Engine Suite', () => {
  const defaultCandidate = {
    targetRoles: ['Backend Developer', 'Node.js Developer'],
    secondaryRoles: ['Full Stack Developer'],
    experienceYears: 2.5,
    skills: [
      { name: 'Node.js', yearsExperience: 2.5, proficiencyLevel: 'STRONG' },
      { name: 'Express.js', yearsExperience: 2.5, proficiencyLevel: 'STRONG' },
      { name: 'JavaScript', yearsExperience: 3.0, proficiencyLevel: 'STRONG' },
      { name: 'TypeScript', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' },
      { name: 'MongoDB', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' },
      { name: 'SQL', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' }
    ],
    preferredLocations: ['Noida', 'Gurgaon', 'Remote'],
    remotePref: RemotePreference.HYBRID,
    salaryMin: 800000
  };

  it('1. Exact Match Test: Candidate matches target role, skills, experience & location', () => {
    const job = {
      title: 'Backend Developer (Node.js & Microservices)',
      companyName: 'Acme Cloud',
      location: 'Noida / Hybrid',
      remoteType: RemotePreference.HYBRID,
      description: 'Build backend microservices with Node.js, Express, TypeScript, SQL.',
      requiredSkills: ['Node.js', 'Express', 'TypeScript', 'SQL'],
      preferredSkills: ['MongoDB'],
      experienceMin: 1,
      experienceMax: 3,
      postedAt: new Date().toISOString(),
      hasRecruiter: true
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, job);

    expect(match.overallScore).toBeGreaterThanOrEqual(90);
    expect(match.priority).toBe('APPLY_NOW');
    expect(match.matchedSkills).toContain('Node.js');
    expect(match.whyApply.length).toBeGreaterThan(0);
  });

  it('2. Synonym Normalization Test: Normalizes JS, TS, ReactJS, Postgres, Node', () => {
    const jobWithShortNames = {
      title: 'Node Engineer',
      companyName: 'TechCorp',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Looking for JS, TS, Node, and Mongo engineer.',
      requiredSkills: ['JS', 'TS', 'Node', 'Mongo'],
      preferredSkills: ['Postgres'],
      experienceMin: 1,
      experienceMax: 3
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, jobWithShortNames);

    expect(match.matchedSkills).toContain('JavaScript');
    expect(match.matchedSkills).toContain('TypeScript');
    expect(match.matchedSkills).toContain('Node.js');
    expect(match.matchedSkills).toContain('MongoDB');
  });

  it('3. Transferable Skills & Partial Credit: Candidate has MongoDB, job asks for PostgreSQL', () => {
    const candidateMongoOnly = {
      ...defaultCandidate,
      skills: [
        { name: 'Node.js', yearsExperience: 2, proficiencyLevel: 'STRONG' },
        { name: 'MongoDB', yearsExperience: 2, proficiencyLevel: 'INTERMEDIATE' }
      ]
    };

    const postgresJob = {
      title: 'Backend Developer',
      companyName: 'DataLabs',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Backend role requiring Node.js and PostgreSQL database expertise.',
      requiredSkills: ['Node.js', 'PostgreSQL'],
      preferredSkills: [],
      experienceMin: 1,
      experienceMax: 3
    };

    const match = advancedMatchingEngine.calculateMatch(candidateMongoOnly, postgresJob);

    expect(match.partialSkills.length).toBeGreaterThan(0);
    expect(match.transferableSkills.length).toBeGreaterThan(0);
    expect(match.transferableSkills[0]).toContain('MongoDB → PostgreSQL');
  });

  it('4. Mandatory Skill Penalty: Missing mandatory Java & Spring Boot reduces score substantially', () => {
    const javaJob = {
      title: 'Senior Java Backend Engineer',
      companyName: 'Legacy Bank',
      location: 'Gurgaon',
      remoteType: RemotePreference.ONSITE,
      description: 'Core banking backend built with Java, Spring Boot, Microservices, Oracle.',
      requiredSkills: ['Java', 'Spring Boot', 'Oracle'],
      preferredSkills: ['Docker'],
      experienceMin: 3,
      experienceMax: 6
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, javaJob);

    expect(match.missingSkills.required).toContain('Java');
    expect(match.missingSkills.required).toContain('Spring Boot');
    expect(match.overallScore).toBeLessThan(65);
    expect(match.priority).toBe('LOW_MATCH');
  });

  it('5. Preferred Skills Minor Impact: Missing preferred skill does not heavily penalize candidate', () => {
    const jobWithPreferred = {
      title: 'Backend Developer',
      companyName: 'CloudScale',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Node.js backend role. Preferred: Kubernetes.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: ['Kubernetes', 'GraphQL'],
      experienceMin: 1,
      experienceMax: 3
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, jobWithPreferred);

    expect(match.missingSkills.preferred).toContain('Kubernetes');
    expect(match.overallScore).toBeGreaterThanOrEqual(80); // Still strong match despite missing preferred skill
  });

  it('6. Experience Mismatch Penalty: 1 yr experience candidate applying for 5+ yr role receives severe penalty', () => {
    const juniorCandidate = {
      ...defaultCandidate,
      experienceYears: 1.0
    };

    const seniorJob = {
      title: 'Staff Backend Architect',
      companyName: 'Enterprise SaaS',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Requires 5+ years building distributed backend architectures.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: [],
      experienceMin: 5,
      experienceMax: 8
    };

    const match = advancedMatchingEngine.calculateMatch(juniorCandidate, seniorJob);

    expect(match.breakdown.experienceScore).toBeLessThan(60);
    expect(match.risks.some(r => r.includes('experience'))).toBe(true);
  });

  it('7. Remote & Location Mismatch Test: Remote gives 100% location score, distant city adds risk', () => {
    const remoteJob = {
      title: 'Backend Engineer',
      companyName: 'RemoteCorp',
      location: 'Worldwide Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Fully remote Node.js role.',
      requiredSkills: ['Node.js'],
      preferredSkills: []
    };

    const remoteMatch = advancedMatchingEngine.calculateMatch(defaultCandidate, remoteJob);
    expect(remoteMatch.breakdown.locationScore).toBe(100);

    const distantOnsiteJob = {
      title: 'Backend Engineer',
      companyName: 'Bangalore Tech',
      location: 'Bangalore',
      remoteType: RemotePreference.ONSITE,
      description: 'Strictly on-site Bangalore role.',
      requiredSkills: ['Node.js'],
      preferredSkills: []
    };

    const distantMatch = advancedMatchingEngine.calculateMatch(defaultCandidate, distantOnsiteJob);
    expect(distantMatch.risks.some(r => r.includes('location'))).toBe(true);
  });

  it('8. Job Freshness & Recruiter Bonus: Fresh jobs posted <6h and with recruiter get bonuses', () => {
    const freshJobWithRecruiter = {
      title: 'Backend Developer',
      companyName: 'FastHire',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Backend role.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: [],
      postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
      hasRecruiter: true
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, freshJobWithRecruiter);

    expect(match.breakdown.freshnessScore).toBe(100);
    expect(match.freshnessLabel).toBe('Very Fresh');
    expect(match.whyApply.some(w => w.includes('recruiter') || w.includes('alignment'))).toBe(true);
  });

  it('9. Test G — Salary Unknown: Undisclosed salary returns null score without 0% penalty', () => {
    const jobNoSalary = {
      title: 'Backend Developer',
      companyName: 'Private Pay Ltd',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Backend role with undisclosed compensation.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: []
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, jobNoSalary);

    expect(match.breakdown.salaryScore).toBeNull();
    expect(match.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('10. Test H — Freshness Comparison: 2h vs 10d old job priority ranking', () => {
    const freshJob = {
      title: 'Backend Engineer',
      companyName: 'FreshCorp',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Role',
      requiredSkills: ['Node.js'],
      preferredSkills: [],
      postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() // 2h ago
    };

    const staleJob = {
      title: 'Backend Engineer',
      companyName: 'StaleCorp',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Role',
      requiredSkills: ['Node.js'],
      preferredSkills: [],
      postedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() // 10 days ago
    };

    const freshMatch = advancedMatchingEngine.calculateMatch(defaultCandidate, freshJob);
    const staleMatch = advancedMatchingEngine.calculateMatch(defaultCandidate, staleJob);

    expect(freshMatch.breakdown.freshnessScore).toBe(100);
    expect(freshMatch.freshnessLabel).toBe('Very Fresh');

    expect(staleMatch.breakdown.freshnessScore).toBe(40);
    expect(staleMatch.freshnessLabel).toBe('Stale');
    expect(freshMatch.overallScore).toBeGreaterThan(staleMatch.overallScore);
  });

  it('11. Edge Cases: Handles empty skills, missing location, and malformed inputs gracefully without crashing', () => {
    const emptyJob = {
      title: 'General Software Engineer',
      companyName: 'Unknown LLC',
      location: '',
      remoteType: RemotePreference.ANY,
      description: '',
      requiredSkills: [],
      preferredSkills: []
    };

    const emptyCandidate = {
      targetRoles: [],
      experienceYears: 0,
      skills: [],
      preferredLocations: [],
      remotePref: RemotePreference.ANY
    };

    const match = advancedMatchingEngine.calculateMatch(emptyCandidate, emptyJob);

    expect(match.overallScore).toBeGreaterThan(0);
    expect(match.breakdown).toBeDefined();
    expect(match.recommendation).toBeDefined();
  });
});
