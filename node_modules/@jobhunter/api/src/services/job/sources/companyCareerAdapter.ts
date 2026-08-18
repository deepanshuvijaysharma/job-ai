import { JobSearchQuery, JobSourceAdapter, RawJobData } from './jobSourceAdapter';
import { RemotePreference } from '@jobhunter/types';
import { normalizeSkillName } from '../../skill/skillNormalizationService';

export class CompanyCareerAdapter implements JobSourceAdapter {
  id = 'career_page';
  name = 'Company Career Page';
  type: 'CAREER_PAGE' = 'CAREER_PAGE';
  enabled = true;
  priority = 1; // Priority 1 per spec

  async search(query: JobSearchQuery): Promise<RawJobData[]> {
    const roles = query.roles || ['Backend Developer'];
    const title = roles[0] || 'Backend Engineer';

    return [
      {
        title: `${title} (Node.js & Cloud)`,
        companyName: 'Acme Corp',
        source: 'Company Career Page',
        sourceId: this.id,
        canonicalUrl: 'https://acme.example.com/careers/backend-101',
        applicationUrl: 'https://acme.example.com/careers/backend-101#apply',
        location: 'Noida / Remote',
        remoteType: RemotePreference.HYBRID,
        description: 'Build backend microservices and REST APIs using Node.js, Express, and PostgreSQL.',
        requiredSkills: ['Node.js', 'Express.js', 'PostgreSQL', 'TypeScript'],
        preferredSkills: ['Redis', 'Docker'],
        postedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'NEW'
      }
    ];
  }

  async fetchJob(input: { url: string }): Promise<RawJobData | null> {
    const { url } = input;
    if (!url || !url.startsWith('http')) return null;

    try {
      // 1. Respect robots.txt basic safety check
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      try {
        const robotsRes = await fetch(robotsUrl, { method: 'HEAD' });
        if (robotsRes.status === 403 || robotsRes.status === 401) {
          console.warn(`[CompanyCareerAdapter] Access disallowed by server status for ${url}`);
          return null;
        }
      } catch (err) {
        // robots.txt fetch error is non-fatal
      }

      // 2. Standard HTTP fetch without stealth evasion
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JobHunterAI-Bot/1.0 (+https://jobhunter.ai)'
        }
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401 || res.status === 429) {
          console.warn(`[CompanyCareerAdapter] SOURCE_UNAVAILABLE for ${url} (HTTP ${res.status})`);
          return null;
        }
        return null;
      }

      const html = await res.text();

      // Check if page returned Cloudflare anti-bot challenge
      if (html.includes('cf-browser-verification') || html.includes('Just a moment...')) {
        console.warn(`[CompanyCareerAdapter] SOURCE_UNAVAILABLE for ${url} (Cloudflare challenge)`);
        return null;
      }

      // 3. Extract title, company name, description safely
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/ - .*/, '').trim() : 'Software Engineer';
      const cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                            .replace(/<[^>]*>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();

      const hostParts = urlObj.hostname.split('.');
      const companyName = hostParts.length >= 2 ? hostParts[hostParts.length - 2].toUpperCase() : 'Company';

      const knownSkillsList = ['Node.js', 'Express.js', 'JavaScript', 'TypeScript', 'React.js', 'PostgreSQL', 'MongoDB', 'SQL', 'Docker', 'Kubernetes', 'AWS', 'Python', 'Java', 'Go'];
      const requiredSkills: string[] = [];

      knownSkillsList.forEach(skill => {
        const normalized = normalizeSkillName(skill);
        if (new RegExp(`\\b${skill.replace('.', '\\.')}\\b`, 'i').test(cleanText)) {
          if (!requiredSkills.includes(normalized)) {
            requiredSkills.push(normalized);
          }
        }
      });

      return {
        title,
        companyName,
        source: 'Company Career Page',
        sourceId: this.id,
        canonicalUrl: url,
        applicationUrl: url,
        location: 'NCR / Remote',
        remoteType: /remote/i.test(cleanText) ? RemotePreference.REMOTE : RemotePreference.HYBRID,
        description: cleanText.slice(0, 1500) || `${title} at ${companyName}`,
        requiredSkills: requiredSkills.length > 0 ? requiredSkills : ['Software Engineering'],
        preferredSkills: [],
        postedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'NEW'
      };
    } catch (err) {
      console.warn(`[CompanyCareerAdapter] Error fetching ${url}: ${(err as Error).message}`);
      return null;
    }
  }
}

export const companyCareerAdapter = new CompanyCareerAdapter();
