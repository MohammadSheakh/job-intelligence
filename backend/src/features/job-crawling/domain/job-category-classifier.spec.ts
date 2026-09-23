import { classifyJobCategories } from './job-category-classifier.js';

describe('JobCategoryClassifier (job-category-classifier.ts)', () => {
  it('correctly classifies Flutter developer role with high confidence from title', () => {
    const result = classifyJobCategories({
      title: 'Senior Flutter Developer',
      description:
        'We are looking for a Flutter engineer to build cross-platform mobile apps using Dart.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('Flutter');
    expect(result.skills).toContain('Flutter');
  });

  it('correctly classifies Full Stack React & Node.js role with domain inferences', () => {
    const result = classifyJobCategories({
      title: 'Full Stack Engineer (React / Node.js)',
      description: 'Work across frontend React applications and backend Node.js microservices.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('React');
    expect(categoryNames).toContain('Node.js');
    expect(categoryNames).toContain('Full Stack');
    expect(categoryNames).toContain('Frontend');
  });

  it('correctly classifies Python and Django Backend Lead', () => {
    const result = classifyJobCategories({
      title: 'Lead Python / Django Developer',
      description: 'Design and optimize backend APIs, PostgreSQL database, and caching.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('Python');
    expect(categoryNames).toContain('Django');
    expect(categoryNames).toContain('Backend');
  });

  it('correctly classifies DevOps and Cloud Infrastructure', () => {
    const result = classifyJobCategories({
      title: 'DevOps / SRE Platform Engineer',
      description: 'Manage AWS infrastructure, Kubernetes clusters, and CI/CD pipelines.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('DevOps/Cloud');
  });

  it('correctly classifies QA / SQA roles', () => {
    const result = classifyJobCategories({
      title: 'Senior SQA Automation Engineer',
      description: 'Write automated test suites with Playwright and Cypress.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('QA/SQA');
  });

  it('correctly classifies UI/UX Product Designer', () => {
    const result = classifyJobCategories({
      title: 'Lead UI/UX Designer',
      description: 'Create Figma prototypes and conduct usability testing.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('UI/UX');
  });

  it('matches skills input when title is generic', () => {
    const result = classifyJobCategories({
      title: 'Software Engineer II',
      skills: 'Laravel, MySQL, PHP, Vue.js',
      description: 'Join our core engineering department.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).toContain('Laravel');
    expect(categoryNames).toContain('PHP');
    expect(categoryNames).toContain('Vue.js');
  });

  it('does not falsely classify Java when title is JavaScript', () => {
    const result = classifyJobCategories({
      title: 'Frontend JavaScript Developer',
      description: 'Modern ES6+ frontend development.',
    });

    const categoryNames = result.categories.map((c) => c.name);
    expect(categoryNames).not.toContain('Java');
    expect(categoryNames).toContain('Frontend');
  });
});
