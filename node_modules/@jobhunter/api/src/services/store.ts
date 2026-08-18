import { 
  ApplicationStatus, 
  CandidateProfileDTO, 
  JobDTO, 
  JobMatchDTO, 
  MatchPriority, 
  RecruiterDTO, 
  RemotePreference, 
  ResumeDTO, 
  UserDTO 
} from '@jobhunter/types';

// In-Memory store & state cache
export class MemoryStore {
  users: Map<string, UserDTO & { passwordHash: string }> = new Map();
  profiles: Map<string, CandidateProfileDTO> = new Map();
  resumes: Map<string, ResumeDTO[]> = new Map(); // userId -> ResumeDTO[]
  jobs: Map<string, JobDTO> = new Map();
  matches: Map<string, JobMatchDTO> = new Map(); // `${userId}_${jobId}` -> JobMatchDTO
  applications: Map<string, any> = new Map(); // `${userId}_${jobId}` -> Application

  constructor() {
    this.initDefaultUser();
    if (process.env.SEED_DEMO_DATA === 'true') {
      this.seedDemoDataForTesting();
    }
  }

  public clearAllData() {
    this.jobs.clear();
    this.matches.clear();
    this.applications.clear();
    this.resumes.clear();
    this.initDefaultUser();
  }

  private initDefaultUser() {
    const defaultUser: UserDTO & { passwordHash: string } = {
      id: 'demo-user-123',
      email: 'deepanshu@example.com',
      name: 'Deepanshu Sharma',
      role: 'USER',
      createdAt: new Date().toISOString(),
      passwordHash: '$2a$10$wT8m9x1...demo'
    };
    this.users.set(defaultUser.id, defaultUser);
    this.users.set(defaultUser.email, defaultUser);

    const defaultProfile: CandidateProfileDTO = {
      id: 'profile-123',
      userId: defaultUser.id,
      phone: '+91 9876543210',
      location: 'Noida, India',
      preferredLocations: ['Noida', 'Delhi NCR', 'Gurgaon', 'Remote'],
      remotePref: RemotePreference.HYBRID,
      experienceYears: 2.5,
      currentRole: 'Full Stack Software Engineer',
      targetRoles: [
        'Backend Developer',
        'Node.js Developer',
        'Full Stack Developer',
        'React.js Developer',
        'AI Software Engineer',
        'SQL Developer',
        'Technical Support'
      ],
      salaryMin: 600000,
      salaryMax: 1200000,
      noticePeriodDays: 30,
      education: [
        { degree: 'B.Tech', field: 'Computer Science & Engineering', institution: 'AKTU University', year: 2023 }
      ],
      certifications: ['AWS Certified Developer Associate', 'Node.js Application Developer'],
      githubUrl: 'https://github.com/deepanshu-dev',
      linkedinUrl: 'https://linkedin.com/in/deepanshu-sharma',
      skills: [
        { name: 'Node.js', yearsExperience: 2.5, proficiencyLevel: 'ADVANCED' },
        { name: 'Express.js', yearsExperience: 2.5, proficiencyLevel: 'ADVANCED' },
        { name: 'JavaScript', yearsExperience: 3.5, proficiencyLevel: 'EXPERT' },
        { name: 'TypeScript', yearsExperience: 2.0, proficiencyLevel: 'ADVANCED' },
        { name: 'React.js', yearsExperience: 2.0, proficiencyLevel: 'ADVANCED' },
        { name: 'MongoDB', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' },
        { name: 'PostgreSQL', yearsExperience: 2.0, proficiencyLevel: 'ADVANCED' },
        { name: 'SQL', yearsExperience: 2.5, proficiencyLevel: 'ADVANCED' },
        { name: 'REST APIs', yearsExperience: 3.0, proficiencyLevel: 'EXPERT' },
        { name: 'Docker', yearsExperience: 1.0, proficiencyLevel: 'INTERMEDIATE' }
      ],
      projects: [
        {
          title: 'JobHunter AI Platform',
          description: 'AI-driven job matching and recruiter outreach automation agent built with Node.js, Express, React, TypeScript and PostgreSQL.',
          techStack: ['Node.js', 'Express', 'React', 'TypeScript', 'PostgreSQL', 'BullMQ', 'Redis']
        },
        {
          title: 'High-Throughput Analytics API',
          description: 'Designed microservice backend handling 5M+ daily requests with Redis caching and PostgreSQL query optimization.',
          techStack: ['Node.js', 'Express', 'Redis', 'PostgreSQL', 'Docker']
        }
      ],
      workExperience: [
        {
          company: 'Nexus Tech Solutions',
          role: 'Full Stack Engineer',
          duration: 'Jul 2023 - Present',
          description: 'Architected Node.js microservices and built React frontends for enterprise SaaS clients.'
        }
      ],
      aiProfileAnalysis: {
        strongSkills: ['Node.js', 'Express.js', 'TypeScript', 'REST APIs', 'PostgreSQL', 'SQL'],
        weakSkills: ['Kubernetes cluster management', 'GraphQL schema design'],
        missingSkills: ['AWS Lambda serverless', 'System design at 10M+ DAU'],
        marketableSkills: ['Node.js Backend & API Engineering', 'React + TypeScript Full Stack', 'SQL Performance Tuning'],
        competitiveRoles: ['Backend Developer', 'Node.js Developer', 'Full Stack Developer', 'SQL Developer'],
        lowProbabilityRoles: ['Principal System Architect', 'Engineering Manager']
      }
    };
    this.profiles.set(defaultUser.id, defaultProfile);

    const defaultResumes: ResumeDTO[] = [
      {
        id: 'res-backend-1',
        userId: defaultUser.id,
        title: 'Backend Node.js & Database Resume',
        fileUrl: '/resumes/backend_node_deepanshu.pdf',
        fileType: 'pdf',
        isDefault: true,
        createdAt: new Date().toISOString()
      }
    ];
    this.resumes.set(defaultUser.id, defaultResumes);
  }

  public seedDemoDataForTesting() {
    const defaultUserId = 'demo-user-123';
    const seedJobs: JobDTO[] = [
      {
        id: 'job-101',
        title: 'Backend Developer (Node.js & Microservices)',
        companyId: 'comp-1',
        companyName: 'Acme Cloud Technologies',
        companyLogo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop',
        source: 'Naukri',
        canonicalUrl: 'https://naukri.com/job/backend-developer-acme-cloud-101',
        applicationUrl: 'https://acmecloud.com/careers/backend-dev-101',
        location: 'Noida / Hybrid',
        remoteType: RemotePreference.HYBRID,
        salaryMin: 800000,
        salaryMax: 1200000,
        experienceMin: 1,
        experienceMax: 3,
        description: 'Seeking a Senior Backend Developer proficient in Node.js, Express, REST APIs, TypeScript, and SQL database design.',
        requiredSkills: ['Node.js', 'Express', 'TypeScript', 'SQL', 'REST API'],
        preferredSkills: ['Redis', 'Docker', 'PostgreSQL'],
        postedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        recruiters: [
          {
            id: 'rec-1',
            companyId: 'comp-1',
            name: 'Amit Sharma',
            role: 'Technical Recruiter - Engineering',
            linkedinUrl: 'https://linkedin.com/in/amit-sharma-recruiter',
            email: 'amit.sharma@acmecloud.com',
            isVerified: true,
            confidence: 0.94,
            source: 'LinkedIn Talent Directory'
          }
        ]
      },
      {
        id: 'job-102',
        title: 'Node.js & React Full Stack Engineer',
        companyId: 'comp-2',
        companyName: 'InnovateX Labs',
        companyLogo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=100&h=100&fit=crop',
        source: 'LinkedIn',
        canonicalUrl: 'https://linkedin.com/jobs/view/nodejs-fullstack-innovatex-102',
        applicationUrl: 'https://innovatex.io/careers/fullstack-102',
        location: 'Gurgaon / Remote',
        remoteType: RemotePreference.REMOTE,
        salaryMin: 900000,
        salaryMax: 1400000,
        experienceMin: 2,
        experienceMax: 4,
        description: 'Looking for a Full Stack Engineer to build customer-facing web applications using React, TypeScript, Node.js.',
        requiredSkills: ['Node.js', 'React.js', 'TypeScript', 'PostgreSQL', 'REST API'],
        preferredSkills: ['Tailwind CSS', 'Redux', 'AWS'],
        postedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        recruiters: [
          {
            id: 'rec-2',
            companyId: 'comp-2',
            name: 'Priya Verma',
            role: 'Talent Acquisition Lead',
            linkedinUrl: 'https://linkedin.com/in/priya-verma-ta',
            email: 'priya.v@innovatex.io',
            isVerified: true,
            confidence: 0.91,
            source: 'Company Career Portal'
          }
        ]
      }
    ];

    seedJobs.forEach(j => {
      this.jobs.set(j.id, j);
      const match: JobMatchDTO = {
        overallScore: j.id === 'job-101' ? 96 : 94,
        priority: MatchPriority.APPLY_NOW,
        breakdown: {
          skillMatch: 95,
          experienceMatch: 90,
          roleMatch: 95,
          locationMatch: 100,
          salaryMatch: 85,
          educationMatch: 90,
          resumeKeywordMatch: 95,
          projectMatch: 90
        },
        whyApply: [
          `95%+ skill alignment with core requirements (${j.requiredSkills.slice(0, 3).join(', ')})`,
          `Target role match for ${j.title}`
        ],
        whatHoldsBack: [
          `Notice period alignment subject to interview confirmation`
        ],
        recommendedResumeId: 'res-backend-1',
        recommendedResumeTitle: 'Backend Node.js & Database Resume'
      };
      this.matches.set(`${defaultUserId}_${j.id}`, match);
    });

    this.applications.set(`${defaultUserId}_job-101`, {
      id: 'app-1',
      userId: defaultUserId,
      jobId: 'job-101',
      status: ApplicationStatus.DISCOVERED,
      qualityScore: 96,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export const memoryStore = new MemoryStore();
