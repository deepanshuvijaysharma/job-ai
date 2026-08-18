import { advancedMatchingEngine } from '../services/job/advancedMatchingEngine';
import { RemotePreference } from '@jobhunter/types';

describe('JobHunter AI Step 4 Final Correction Matching Engine Test Suite', () => {
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

  it('1. Test 1 — Salary Unknown: Undisclosed salary returns null score with weight renormalization', () => {
    const jobNoSalary = {
      title: 'Backend Developer',
      companyName: 'Private Pay Corp',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Role with undisclosed compensation.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: []
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, jobNoSalary);

    expect(match.breakdown.salaryScore).toBeNull();
    // Renormalization scales remaining 95% weights back to 100%
    expect(match.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('2. Test 2 — Salary Disclosed: Calculates actual salary compatibility', () => {
    const jobWithSalary = {
      title: 'Backend Developer',
      companyName: 'HighPay Tech',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Role with disclosed salary.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: [],
      salaryMin: 900000,
      salaryMax: 1500000
    };

    const match = advancedMatchingEngine.calculateMatch(defaultCandidate, jobWithSalary);

    expect(match.breakdown.salaryScore).toBe(100);
    expect(match.overallScore).toBeGreaterThanOrEqual(90);
  });

  it('3. Test 3 — Severe Experience Gap: Candidate 1 yr vs Job 5 yr minimum triggers override', () => {
    const juniorCandidate = {
      ...defaultCandidate,
      experienceYears: 1.0
    };

    const seniorJob = {
      title: 'Staff Backend Architect',
      companyName: 'Enterprise SaaS',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Requires 5+ years minimum experience.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: [],
      experienceMin: 5,
      experienceMax: 8
    };

    const match = advancedMatchingEngine.calculateMatch(juniorCandidate, seniorJob);

    expect(match.recommendation).not.toBe('APPLY_NOW');
    expect(match.recommendation).not.toBe('STRONG_MATCH');
    expect(match.recommendationReason?.toLowerCase()).toContain('experience');
    expect(match.breakdown.experienceScore).toBeLessThan(60);
  });

  it('4. Test 4 — Moderate Experience Gap: Candidate 2 yrs vs Job 4 yrs minimum penalizes without severe override', () => {
    const midCandidate = {
      ...defaultCandidate,
      experienceYears: 2.0
    };

    const midSeniorJob = {
      title: 'Senior Backend Engineer',
      companyName: 'MidScale Inc',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Requires 4 years minimum experience.',
      requiredSkills: ['Node.js', 'Express.js'],
      preferredSkills: [],
      experienceMin: 4,
      experienceMax: 6
    };

    const match = advancedMatchingEngine.calculateMatch(midCandidate, midSeniorJob);

    expect(match.breakdown.experienceScore).toBeLessThan(90);
    // Gap = 2 yrs < 3 yrs threshold, so no severe override mandatory reason
    expect(match.recommendationReason).toBeUndefined();
  });

  it('5. Test 5 — Project Relevance: Strong overlap > Moderate overlap > Weak overlap > No project', () => {
    const job = {
      title: 'Backend Developer',
      companyName: 'ProjectCorp',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Node.js, PostgreSQL, Docker',
      requiredSkills: ['Node.js', 'PostgreSQL', 'Docker'],
      preferredSkills: []
    };

    // Strong overlap: candidate project has 2/3 required skills
    const candStrong = {
      ...defaultCandidate,
      projects: [{ title: 'Microservices Engine', techStack: ['Node.js', 'PostgreSQL'] }]
    };

    // Weak overlap: candidate project has 0 required skills
    const candWeak = {
      ...defaultCandidate,
      projects: [{ title: 'UI Kit', techStack: ['CSS', 'HTML'] }]
    };

    // No projects
    const candNoProj = {
      ...defaultCandidate,
      projects: []
    };

    const strongMatch = advancedMatchingEngine.calculateMatch(candStrong, job);
    const weakMatch = advancedMatchingEngine.calculateMatch(candWeak, job);
    const noProjMatch = advancedMatchingEngine.calculateMatch(candNoProj, job);

    expect(strongMatch.breakdown.projectScore).toBeGreaterThan(weakMatch.breakdown.projectScore);
    expect(weakMatch.breakdown.projectScore).toBeGreaterThanOrEqual(noProjMatch.breakdown.projectScore);
  });

  it('6. Synonym Normalization & Transferable Skills Test', () => {
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
});
