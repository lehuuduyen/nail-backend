/**
 * Generates one new nail-related blog post using Claude API and saves it to the DB.
 * Run standalone: node src/scripts/generateDailyBlogPost.js
 * Or invoked by dailyBlogCron.js on a schedule.
 */
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { sequelize, BlogPost } = require('../models');

const client = new Anthropic();

// Topic pool — Claude picks from these to keep content varied
const TOPICS = [
  'gel nails vs acrylic nails phoenix',
  'how to make nail polish last longer',
  'nail art trends phoenix az',
  'best nail shapes for short fingers',
  'spa pedicure benefits phoenix',
  'nail care for dry desert climate arizona',
  'how often should you get a manicure',
  'ombre nails guide phoenix',
  'nail health warning signs you should not ignore',
  'french manicure classic vs modern phoenix',
  'what is a hot stone pedicure',
  'nail filing techniques and nail shapes explained',
  'shellac vs gel manicure differences',
  'cuticle care tips nail technician advice',
  'kid-friendly nail salon services phoenix',
  'nail salon etiquette tips for first-timers',
  'best nail colors for summer phoenix az',
  'paraffin wax treatment hands and feet benefits',
  'how to remove gel nails safely at home',
  'nail strengthening treatments phoenix spa',
  'luxury pedicure what to expect nice nails spa',
  'nail salon hygiene what to look for',
  'dip powder nails pros and cons',
  'wedding nail ideas phoenix bridal',
  'vitamins and foods for stronger nails',
  'nail art for beginners phoenix',
  'chrome and mirror nails trend phoenix',
  'foot care tips for phoenix desert heat',
  'nail glitter and foil designs guide',
  'men nail care manicure phoenix az',
];

const INTERNAL_LINKS = {
  services: '/services',
  manicure: '/services/manicure',
  pedicure: '/services/pedicure',
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 110);
}

async function pickUnusedTopic() {
  const existing = await BlogPost.findAll({ attributes: ['slug'], raw: true });
  const existingSlugs = new Set(existing.map((r) => r.slug));

  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);
  for (const topic of shuffled) {
    const candidate = slugify(topic);
    if (!existingSlugs.has(candidate)) return topic;
  }
  // Fallback: append today's date to avoid duplicate
  const today = new Date().toISOString().slice(0, 10);
  return `nail care tips phoenix az ${today}`;
}

const BLOG_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'URL-friendly slug, max 110 chars, lowercase, hyphens' },
    title: { type: 'string', description: 'SEO title, max 70 chars' },
    metaTitle: { type: 'string', description: 'Meta title for SEO, max 60 chars' },
    metaDescription: {
      type: 'string',
      description: 'Meta description for SEO, 140-160 chars',
    },
    excerpt: { type: 'string', description: '2-3 sentence teaser shown on blog listing page' },
    content: {
      type: 'string',
      description:
        'Full HTML blog post, 700-900 words. Must include at least 2 internal anchor links.',
    },
    keywords: {
      type: 'string',
      description: 'Comma-separated SEO keywords, up to 10 terms',
    },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
      },
      description: '3 FAQ items for schema markup',
    },
    readingMinutes: { type: 'number', description: 'Estimated reading time in minutes (3-6)' },
  },
  required: [
    'slug',
    'title',
    'metaTitle',
    'metaDescription',
    'excerpt',
    'content',
    'keywords',
    'faqs',
    'readingMinutes',
  ],
};

async function generateBlogPost(topic) {
  const systemPrompt = `You are an expert nail salon content writer for Nice Nails & Spa, a premier nail salon in Phoenix, AZ.
Write helpful, SEO-optimized blog posts in a warm, professional tone.

Internal links you MUST include naturally in the content HTML (use <a href="..."> tags):
- Services page: ${INTERNAL_LINKS.services}
- Manicure services: ${INTERNAL_LINKS.manicure}
- Pedicure services: ${INTERNAL_LINKS.pedicure}

Include at least 2 of the 3 links above per post. Link text should be natural (e.g., "our manicure services", "book a pedicure", "explore our services").

Salon name: Nice Nails & Spa
Location: Phoenix, Arizona
Brand voice: Professional, welcoming, knowledgeable about nail care.`;

  const userPrompt = `Write a complete SEO-optimized blog post about: "${topic}"

The post must:
- Be geo-targeted to Phoenix, AZ where relevant
- Include practical, useful information
- Use proper HTML in the content field: <h2>, <p>, <ul>/<li>, <strong>
- Naturally link to our services pages using <a> tags
- Include 3 FAQs that real customers would ask
- Be 700-900 words in the content field`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: {
        type: 'json_schema',
        name: 'blog_post',
        schema: BLOG_SCHEMA,
        strict: true,
      },
    },
  });

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('No text content in Claude response');
  return JSON.parse(text);
}

async function main() {
  await sequelize.authenticate();
  await BlogPost.sync({ alter: true });

  const topic = await pickUnusedTopic();
  console.log(`Generating blog post for topic: "${topic}"`);

  const post = await generateBlogPost(topic);

  // Ensure slug is URL-safe (Claude might return slightly different format)
  post.slug = slugify(post.slug || topic);

  const payload = {
    title: post.title,
    metaTitle: post.metaTitle ?? null,
    excerpt: post.excerpt,
    content: post.content,
    metaDescription: post.metaDescription,
    keywords: post.keywords ?? null,
    faqs: post.faqs ?? null,
    readingMinutes: post.readingMinutes ?? 4,
    publishedAt: new Date(),
    published: true,
  };

  const [row, created] = await BlogPost.findOrCreate({
    where: { slug: post.slug },
    defaults: { slug: post.slug, ...payload },
  });

  if (!created) {
    // Slug collision — append today's date
    const today = new Date().toISOString().slice(0, 10);
    const newSlug = `${post.slug}-${today}`.slice(0, 110);
    await BlogPost.create({ slug: newSlug, ...payload });
    console.log(`+ created  /blog/${newSlug} (slug collision, date appended)`);
  } else {
    console.log(`+ created  /blog/${post.slug}`);
  }

  console.log(`Title: ${post.title}`);
  await sequelize.close();
}

main().catch((e) => {
  console.error('Error generating blog post:', e.message);
  process.exit(1);
});
