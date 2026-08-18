export const SKILL_SYNONYMS: Record<string, string> = {
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'reactjs': 'React.js',
  'react.js': 'React.js',
  'react': 'React.js',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'rest': 'REST API',
  'rest api': 'REST API',
  'restful api': 'REST API',
  'py': 'Python',
  'python': 'Python',
  'aws': 'AWS',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'sql': 'SQL',
  'express': 'Express.js',
  'expressjs': 'Express.js'
};

export const normalizeSkillName = (rawSkill: string): string => {
  if (!rawSkill) return 'UNKNOWN';
  const key = rawSkill.trim().toLowerCase();
  return SKILL_SYNONYMS[key] || rawSkill.trim();
};
