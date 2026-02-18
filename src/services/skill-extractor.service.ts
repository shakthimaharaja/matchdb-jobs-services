// Keyword-based skill extraction from free-form resume/job text
// Skills are matched case-insensitively against a curated list.

const SKILLS_LIST: string[] = [
  // Languages
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP',
  'Ruby', 'Swift', 'Kotlin', 'R', 'Scala', 'Dart', 'Perl', 'Bash', 'Shell', 'Groovy',
  // Frontend
  'React', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte', 'HTML', 'CSS',
  'Tailwind', 'Redux', 'GraphQL', 'REST', 'Bootstrap', 'SASS', 'LESS',
  'Webpack', 'Vite', 'jQuery', 'Ember', 'Backbone',
  // Backend
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Spring',
  '.NET', 'ASP.NET', 'Laravel', 'Rails', 'NestJS', 'Fastify', 'Gin', 'Echo',
  'Hapi', 'Koa',
  // Databases
  'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch', 'DynamoDB',
  'Cassandra', 'SQLite', 'Oracle', 'MSSQL', 'MariaDB', 'Firestore', 'CouchDB',
  'Neo4j', 'InfluxDB',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible',
  'Jenkins', 'GitHub Actions', 'CircleCI', 'CI/CD', 'Linux', 'Nginx', 'Apache',
  'Helm', 'ArgoCD', 'Prometheus', 'Grafana', 'ELK', 'Datadog',
  // Data & AI / ML
  'Machine Learning', 'TensorFlow', 'PyTorch', 'pandas', 'NumPy', 'Scikit-learn',
  'Data Science', 'SQL', 'Power BI', 'Tableau', 'Spark', 'Hadoop',
  'Natural Language Processing', 'NLP', 'Computer Vision', 'Deep Learning',
  'LLM', 'OpenAI', 'Langchain', 'Airflow', 'dbt', 'Looker',
  // Tools & Practices
  'Git', 'JIRA', 'Figma', 'Agile', 'Scrum', 'Microservices', 'API',
  'Prisma', 'Mongoose', 'Stripe', 'SendGrid', 'Kafka', 'RabbitMQ',
  'gRPC', 'WebSocket', 'OAuth', 'JWT', 'LDAP',
  // Mobile
  'React Native', 'Flutter', 'iOS', 'Android', 'Xamarin', 'Ionic',
  // Testing
  'Jest', 'Cypress', 'Selenium', 'Playwright', 'Mocha', 'JUnit',
  // Other popular
  'Shopify', 'Salesforce', 'SAP', 'Tableau', 'Power Automate',
];

export function extractSkills(text: string): string[] {
  if (!text || !text.trim()) return [];

  const found = new Set<string>();

  for (const skill of SKILLS_LIST) {
    const skillLower = skill.toLowerCase();

    if (skillLower.includes(' ') || skillLower.includes('.') || skillLower.includes('+') || skillLower.includes('#')) {
      // Multi-word / special-char skills: substring search on the full text
      if (text.toLowerCase().includes(skillLower)) {
        found.add(skill);
      }
    } else {
      // Single-word skills: match as whole word (case-insensitive)
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        found.add(skill);
      }
    }
  }

  return Array.from(found);
}
