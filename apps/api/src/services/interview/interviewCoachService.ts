import { aiManager } from '../ai/aiProvider';

export interface InterviewQuestionItem {
  category: 'JavaScript' | 'Node.js' | 'React' | 'SQL' | 'System Design' | 'Behavioral';
  question: string;
  suggestedAnswer: string;
}

export interface InterviewPrepPlan {
  jobTitle: string;
  companyName: string;
  companyOverview: string;
  likelyTopics: string[];
  questionBank: InterviewQuestionItem[];
}

export class InterviewCoachService {
  async generatePrepPlan(
    jobTitle: string,
    companyName: string,
    requiredSkills: string[]
  ): Promise<InterviewPrepPlan> {
    const systemPrompt = `You are a Senior Technical Interview Coach.
Generate a structured preparation plan for candidate interviewing for "${jobTitle}" at "${companyName}".
Skills: ${requiredSkills.join(', ')}.

Return JSON object:
{
  jobTitle,
  companyName,
  companyOverview: string,
  likelyTopics: string[],
  questionBank: array of { category, question, suggestedAnswer }
}`;

    const userPrompt = `Target Role: ${jobTitle}
Company: ${companyName}
Required Skills: ${requiredSkills.join(', ')}`;

    return aiManager.completeJSON<InterviewPrepPlan>(
      systemPrompt,
      userPrompt,
      () => this.heuristicFallbackPlan(jobTitle, companyName, requiredSkills)
    );
  }

  private heuristicFallbackPlan(
    jobTitle: string,
    companyName: string,
    requiredSkills: string[]
  ): InterviewPrepPlan {
    return {
      jobTitle,
      companyName,
      companyOverview: `${companyName} is a high-growth tech enterprise focused on engineering excellence and scalable architecture.`,
      likelyTopics: ['Node.js Event Loop & Async Processing', 'REST API Performance & Caching', 'SQL Query Optimization', 'React State Management', 'Behavioral Scenarios'],
      questionBank: [
        {
          category: 'Node.js',
          question: 'How does the Node.js Event Loop process asynchronous non-blocking I/O tasks?',
          suggestedAnswer: 'The Event Loop operates off libuv with phases: Timers, Pending I/O, Idle/Prepare, Poll, Check (setImmediate), and Close callbacks. Microtasks (process.nextTick, Promise callbacks) drain immediately between phases.'
        },
        {
          category: 'SQL',
          question: 'How do B-Tree indexes improve query latency in PostgreSQL, and when might an index degrade performance?',
          suggestedAnswer: 'B-Tree indexes reduce lookup complexity from O(N) sequential scan to O(log N). However, excessive indexes slow down INSERT/UPDATE/DELETE operations due to index maintenance overhead.'
        },
        {
          category: 'React',
          question: 'Explain the difference between useMemo, useCallback, and React.memo.',
          suggestedAnswer: 'React.memo prevents component re-renders if props have not changed. useMemo memoizes computed values, while useCallback memoizes function instances across renders.'
        },
        {
          category: 'System Design',
          question: 'How would you design rate-limiting for a high-traffic Node.js REST API using Redis?',
          suggestedAnswer: 'Use Redis Token Bucket or Sliding Window Log via atomic Lua scripts or INCR + EXPIRE keys to enforce IP/token rate limits with sub-millisecond overhead.'
        },
        {
          category: 'Behavioral',
          question: 'Tell me about a challenging bug you debugged in production.',
          suggestedAnswer: 'Described a scenario involving connection pool exhaustion under load, traced via log analysis, and resolved by optimizing SQL query indexing and implementing Redis connection pooling.'
        }
      ]
    };
  }
}

export const interviewCoachService = new InterviewCoachService();
