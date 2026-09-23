export interface JobClassificationInput {
  title: string;
  description?: string | null;
  skills?: string | null;
}

export interface ClassifiedCategory {
  name: string;
  type: 'technology' | 'domain';
  source: 'title' | 'skills' | 'description';
}

export interface JobClassificationResult {
  categories: ClassifiedCategory[];
  skills: string[];
}

interface CategoryRule {
  name: string;
  type: 'technology' | 'domain';
  titlePatterns: RegExp[];
  contentPatterns: RegExp[];
}

const CATEGORY_RULES: CategoryRule[] = [
  // ─── Technologies ───────────────────────────────────────────
  {
    name: '.NET',
    type: 'technology',
    titlePatterns: [/\b(\.net|dotnet|asp\.net|c#)\b/i],
    contentPatterns: [/\b(\.net core|asp\.net core|\.net framework|\bdotnet\b|\bc#\b)/i],
  },
  {
    name: 'Django',
    type: 'technology',
    titlePatterns: [/\b(django)\b/i],
    contentPatterns: [/\b(django|djangorestframework|django rest)\b/i],
  },
  {
    name: 'Flutter',
    type: 'technology',
    titlePatterns: [/\b(flutter)\b/i],
    contentPatterns: [/\b(flutter|dart)\b/i],
  },
  {
    name: 'Java',
    type: 'technology',
    titlePatterns: [/\b(java|spring boot|spring)\b/i],
    contentPatterns: [/\b(java\b(?!\s*script)|spring boot|hibernate|jvm)\b/i],
  },
  {
    name: 'Joomla',
    type: 'technology',
    titlePatterns: [/\b(joomla)\b/i],
    contentPatterns: [/\b(joomla)\b/i],
  },
  {
    name: 'Laravel',
    type: 'technology',
    titlePatterns: [/\b(laravel)\b/i],
    contentPatterns: [/\b(laravel)\b/i],
  },
  {
    name: 'NestJS',
    type: 'technology',
    titlePatterns: [/\b(nestjs|nest[\s.]js)\b/i],
    contentPatterns: [/\b(nestjs|nest[\s.]js)\b/i],
  },
  {
    name: 'Next.js',
    type: 'technology',
    titlePatterns: [/\b(nextjs|next[\s.]js)\b/i],
    contentPatterns: [/\b(nextjs|next[\s.]js)\b/i],
  },
  {
    name: 'Node.js',
    type: 'technology',
    titlePatterns: [/\b(nodejs|node[\s.]js|\bnode developer\b)\b/i],
    contentPatterns: [/\b(nodejs|node[\s.]js|expressjs|express\.js)\b/i],
  },
  {
    name: 'Odoo/ERP',
    type: 'technology',
    titlePatterns: [/\b(odoo|erp developer|erp specialist|sap)\b/i],
    contentPatterns: [/\b(odoo|enterprise resource planning)\b/i],
  },
  {
    name: 'PHP',
    type: 'technology',
    titlePatterns: [/\b(php)\b/i],
    contentPatterns: [/\b(php|lamp stack)\b/i],
  },
  {
    name: 'Python',
    type: 'technology',
    titlePatterns: [/\b(python)\b/i],
    contentPatterns: [/\b(python|fastapi|pandas|numpy)\b/i],
  },
  {
    name: 'React',
    type: 'technology',
    titlePatterns: [/\b(react|reactjs|react[\s.]js|react native)\b/i],
    contentPatterns: [/\b(react|reactjs|react[\s.]js|react native|redux)\b/i],
  },
  {
    name: 'Vue.js',
    type: 'technology',
    titlePatterns: [/\b(vue|vuejs|vue[\s.]js|nuxt|nuxtjs)\b/i],
    contentPatterns: [/\b(vue|vuejs|vue[\s.]js|nuxt|nuxtjs|pinia|vuex)\b/i],
  },
  {
    name: 'WordPress',
    type: 'technology',
    titlePatterns: [/\b(wordpress|wpdeveloper|wp\s*developer|woocommerce)\b/i],
    contentPatterns: [/\b(wordpress|woocommerce)\b/i],
  },

  // ─── Domains ────────────────────────────────────────────────
  {
    name: 'AI',
    type: 'domain',
    titlePatterns: [
      /\b(artificial intelligence|generative ai|genai|llm developer|prompt engineer)\b/i,
      /\bai\b(?!\s*(?:driven|first|powered)\b)/i,
    ],
    contentPatterns: [/\b(artificial intelligence|generative ai|genai|llms?|langchain|rag)\b/i],
  },
  {
    name: 'AR/VR',
    type: 'domain',
    titlePatterns: [
      /\b(ar\/vr|augmented reality|virtual reality|metaverse|unity developer|unreal engine)\b/i,
    ],
    contentPatterns: [/\b(augmented reality|virtual reality|unity3d|unreal engine)\b/i],
  },
  {
    name: 'Backend',
    type: 'domain',
    titlePatterns: [/\b(back\s*end|backend|server\s*side)\b/i],
    contentPatterns: [/\b(backend architecture|back\s*end development|rest api|microservices)\b/i],
  },
  {
    name: 'Cybersecurity',
    type: 'domain',
    titlePatterns: [
      /\b(cyber\s*security|information security|infosec|security engineer|soc analyst|penetration test(er|ing)|vapt)\b/i,
    ],
    contentPatterns: [
      /\b(cybersecurity|infosec|penetration testing|vulnerability assessment|siem)\b/i,
    ],
  },
  {
    name: 'Data Analytics',
    type: 'domain',
    titlePatterns: [/\b(data analy(tics?|st)|business intelligence|bi analyst|bi developer)\b/i],
    contentPatterns: [/\b(data analytics|business intelligence|power bi|tableau|metabase)\b/i],
  },
  {
    name: 'Data Engineering',
    type: 'domain',
    titlePatterns: [/\b(data engineer(ing)?|etl developer|big data engineer)\b/i],
    contentPatterns: [/\b(data pipelines?|data warehouse|spark|hadoop|dbt|airflow|kafka)\b/i],
  },
  {
    name: 'Data Science',
    type: 'domain',
    titlePatterns: [/\b(data scien(tist|ce))\b/i],
    contentPatterns: [/\b(data science|predictive modeling|statistical modeling)\b/i],
  },
  {
    name: 'DevOps/Cloud',
    type: 'domain',
    titlePatterns: [
      /\b(devops|devsecops|cloud engineer|sre|site reliability|infrastructure engineer|platform engineer)\b/i,
    ],
    contentPatterns: [/\b(devops|ci\/cd|kubernetes|docker|terraform|aws|gcp|azure cloud)\b/i],
  },
  {
    name: 'Embedded/IoT',
    type: 'domain',
    titlePatterns: [/\b(embedded|iot|internet of things|firmware|hardware engineer)\b/i],
    contentPatterns: [/\b(embedded systems?|microcontroller|rtos|pcb design|esp32|arduino)\b/i],
  },
  {
    name: 'Frontend',
    type: 'domain',
    titlePatterns: [/\b(front\s*end|frontend|client\s*side|ui developer|web developer)\b/i],
    contentPatterns: [/\b(frontend architecture|front\s*end development|responsive design)\b/i],
  },
  {
    name: 'Full Stack',
    type: 'domain',
    titlePatterns: [/\b(full\s*stack|fullstack|mern|mean)\b/i],
    contentPatterns: [/\b(full\s*stack|fullstack development)\b/i],
  },
  {
    name: 'Identity/Biometrics',
    type: 'domain',
    titlePatterns: [/\b(biometrics?|facial recognition|access control|identity management|iam)\b/i],
    contentPatterns: [
      /\b(biometric identification|facial recognition|fingerprint|okta|keycloak)\b/i,
    ],
  },
  {
    name: 'Machine Learning',
    type: 'domain',
    titlePatterns: [
      /\b(machine learning|ml engineer|deep learning|nlp engineer|computer vision)\b/i,
    ],
    contentPatterns: [/\b(machine learning|deep learning|tensorflow|pytorch|scikit-learn)\b/i],
  },
  {
    name: 'Networking',
    type: 'domain',
    titlePatterns: [/\b(network(ing)? engineer|network administrator|noc engineer|ccna|ccnp)\b/i],
    contentPatterns: [
      /\b(routing and switching|network infrastructure|cisco|firewall configuration)\b/i,
    ],
  },
  {
    name: 'QA/SQA',
    type: 'domain',
    titlePatterns: [
      /\b(qa\b|sqa\b|quality assurance|software test(er|ing)|test engineer|automation test(er|ing))\b/i,
    ],
    contentPatterns: [
      /\b(test automation|selenium|cypress|playwright|manual testing|test plans)\b/i,
    ],
  },
  {
    name: 'UI/UX',
    type: 'domain',
    titlePatterns: [
      /\b(ui\/ux|ux\/ui|ux designer|ui designer|product designer|visual designer)\b/i,
    ],
    contentPatterns: [/\b(wireframing|prototyping|user research|figma|usability testing)\b/i],
  },
];

/**
 * Classifies a job opening based on title, skills, and description.
 * Title patterns have highest priority and can match categories directly.
 * Skills matches are also authoritative.
 * Description patterns match if title didn't contradict or if confident.
 */
export function classifyJobCategories(input: JobClassificationInput): JobClassificationResult {
  const title = input.title || '';
  const skillsText = input.skills || '';
  const description = input.description || '';

  const matchedCategories = new Map<string, ClassifiedCategory>();
  const extractedSkills = new Set<string>();

  // 1. Evaluate Title matches (highest confidence)
  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.titlePatterns) {
      if (pattern.test(title)) {
        matchedCategories.set(rule.name, {
          name: rule.name,
          type: rule.type,
          source: 'title',
        });
        extractedSkills.add(rule.name);
        break;
      }
    }
  }

  // 2. Evaluate Skills input matches
  if (skillsText) {
    for (const rule of CATEGORY_RULES) {
      if (matchedCategories.has(rule.name)) continue;
      for (const pattern of [...rule.titlePatterns, ...rule.contentPatterns]) {
        if (pattern.test(skillsText)) {
          matchedCategories.set(rule.name, {
            name: rule.name,
            type: rule.type,
            source: 'skills',
          });
          extractedSkills.add(rule.name);
          break;
        }
      }
    }
  }

  // 3. Evaluate Description matches
  if (description) {
    for (const rule of CATEGORY_RULES) {
      if (matchedCategories.has(rule.name)) continue;
      for (const pattern of rule.contentPatterns) {
        if (pattern.test(description)) {
          matchedCategories.set(rule.name, {
            name: rule.name,
            type: rule.type,
            source: 'description',
          });
          extractedSkills.add(rule.name);
          break;
        }
      }
    }
  }

  // 4. Infer implied Domains from matched Technologies if not already explicitly set
  // e.g. React -> Frontend; Laravel -> Backend; NestJS -> Backend; Flutter -> Frontend
  const catNames = new Set(matchedCategories.keys());
  if (
    (catNames.has('React') || catNames.has('Vue.js') || catNames.has('Next.js')) &&
    !catNames.has('Frontend')
  ) {
    matchedCategories.set('Frontend', {
      name: 'Frontend',
      type: 'domain',
      source: 'title',
    });
  }
  if (
    (catNames.has('Laravel') ||
      catNames.has('Django') ||
      catNames.has('NestJS') ||
      catNames.has('.NET') ||
      catNames.has('PHP') ||
      catNames.has('Java') ||
      catNames.has('Node.js')) &&
    !catNames.has('Backend')
  ) {
    matchedCategories.set('Backend', {
      name: 'Backend',
      type: 'domain',
      source: 'title',
    });
  }

  // Return formatted results
  return {
    categories: Array.from(matchedCategories.values()),
    skills: Array.from(extractedSkills),
  };
}
