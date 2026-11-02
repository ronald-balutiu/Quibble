// Lighthouse CI (npm run lighthouse): audits the production build, served as
// Cloudflare would (scripts/lighthouse-server.ts), with Lighthouse's default mobile
// emulation and simulated slow 4G, three runs per page. Run npm run build first.
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'tsx --tsconfig tsconfig.node.json scripts/lighthouse-server.ts',
      startServerReadyPattern: 'Lighthouse server ready',
      url: [
        'http://127.0.0.1:4174/',
        'http://127.0.0.1:4174/play',
        'http://127.0.0.1:4174/play/oddly-specific/1',
        'http://127.0.0.1:4174/about',
      ],
      numberOfRuns: 3,
    },
    // Asserted on each page's median run, so one noisy run can't fail the job.
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
}
