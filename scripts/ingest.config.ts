export const config = {
  baseUrl: 'https://commecscollege.edu.pk',
  hostAllowlist: ['commecscollege.edu.pk'],
  apiPaths: {
    pages: '/wp-json/wp/v2/pages',
    posts: '/wp-json/wp/v2/posts',
    categories: '/wp-json/wp/v2/categories',
    media: '/wp-json/wp/v2/media'
  },
  thresholds: {
    lowValueWordCount: 30,
    overCleanedRatio: 0.6
  },
  rules: {
    excludeSlugs: [
      'thesis', 'cart', 'checkout', 'my-account',
      'sample-page', 'faculty-duplicate-976',
      'macro-plans-2021-2022', 'time-table-2021-2022'
    ],
    excludeTitles: [/thesis/i],
    excludeCategoryIds: [],
    excludeCategoryNames: [/thesis/i],
    includeSlugs: ['about']
  },
  fetch: {
    delayMs: 300,
    maxRetries: 3,
    timeoutMs: 15000,
    userAgent: 'CommecsChatbotIngest/1.0 (student hackathon project)'
  }
};