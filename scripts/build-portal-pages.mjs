// Writes the HTML shells for the client portal and coach dashboard.
//   node scripts/build-portal-pages.mjs && node scripts/sync-partials.mjs
// Each page is a thin shell; the module script renders the content after checking the session.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const { assetVersion: V } = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

const trend = `<svg class="trend" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#B8F36B" stop-opacity="0.16"/><stop offset="1" stop-color="#B8F36B" stop-opacity="0"/></linearGradient></defs><path class="trend-area" d="M0,360 C120,352 180,330 260,322 S400,330 470,300 S600,250 680,246 S820,210 900,168 S1060,120 1200,64 L1200,400 L0,400 Z"/><path class="trend-line" pathLength="1" d="M0,360 C120,352 180,330 260,322 S400,330 470,300 S600,250 680,246 S820,210 900,168 S1060,120 1200,64"/></svg>`;
const brand = `<a class="brand" href="/"><svg class="brand-mark" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" fill="#242925"/><path d="M7 23.5l6-6.5 4.5 3.5L27 10" fill="none" stroke="#B8F36B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="10" r="2.6" fill="#B8F36B"/></svg><span class="brand-name">GetFitWith<b>Pratik</b></span></a>`;

const head = (title) => `<!doctype html>
<html lang="en-IN">
<head>
<!-- @head -->
<!-- /@head -->
<title>${title} | GetFitWithPratik</title>
<meta name="description" content="GetFitWithPratik client portal.">
</head>`;

const authPage = ({ title, side, page }) => `${head(title)}
<body class="app" data-page="${page}">
<div class="auth">
  <aside class="auth-side">
    ${brand}
    <h2>${side}</h2>
    <p class="muted" style="max-width:40ch;position:relative;z-index:2">Your plan, daily logs, progress photos and weekly check-ins, in one private place.</p>
    ${trend}
  </aside>
  <main class="auth-main" id="main" data-auth>
    ${brand}
    <div class="skeleton" style="height:40px;max-width:280px"></div>
    <div class="skeleton" style="height:200px;margin-top:20px"></div>
  </main>
</div>
<div class="toasts" aria-live="polite" data-toasts></div>
<script type="module" src="/js/portal/auth.js?v=${V}"></script>
</body>
</html>
`;

const appPage = ({ title, script }) => `${head(title)}
<body class="app">
<div style="display:grid;place-items:center;min-height:100vh"><div class="skeleton" style="width:220px;height:20px"></div></div>
<script type="module" src="${script}?v=${V}"></script>
</body>
</html>
`;

const write = (dir, content) => { mkdirSync(join(root, dir), { recursive: true }); writeFileSync(join(root, dir, 'index.html'), content); };

write('portal', authPage({ title: 'Client portal', side: 'Welcome back.', page: 'router' }));
write('portal/login', authPage({ title: 'Log in', side: 'Show up. Log it. Get better every week.', page: 'login' }));
write('portal/register', authPage({ title: 'Create your account', side: 'Your coaching, organised.', page: 'register' }));
write('portal/forgot', authPage({ title: 'Reset your password', side: 'Happens to everyone.', page: 'forgot' }));
write('portal/reset', authPage({ title: 'Choose a new password', side: 'Almost there.', page: 'reset' }));
write('portal/pending', authPage({ title: 'Account status', side: 'Your coaching, organised.', page: 'pending' }));

write('portal/dashboard', appPage({ title: 'Dashboard', script: '/js/portal/dashboard.js' }));
write('portal/logs', appPage({ title: 'Food and workouts', script: '/js/portal/logs.js' }));
write('portal/progress', appPage({ title: 'Progress', script: '/js/portal/progress.js' }));
write('portal/checkins', appPage({ title: 'Weekly check-in', script: '/js/portal/checkins.js' }));
write('portal/plan', appPage({ title: 'My plan', script: '/js/portal/plan.js' }));
write('portal/library', appPage({ title: 'Library', script: '/js/portal/library.js' }));
write('portal/profile', appPage({ title: 'Profile', script: '/js/portal/profile.js' }));
write('admin', appPage({ title: 'Coach dashboard', script: '/js/admin/main.js' }));

// Old URLs keep working: small redirect pages at the previous file paths.
const stubs = {
  'pages/book.html': '/book', 'pages/calculator.html': '/calculator', 'pages/feedback.html': '/feedback',
  'pages/transformations.html': '/transformations', 'pages/admin.html': '/admin/', 'pages/admin-login.html': '/portal/login/',
  'portal/login.html': '/portal/login/', 'portal/signup.html': '/portal/register/', 'portal/dashboard.html': '/portal/dashboard/',
  'portal/log.html': '/portal/logs/', 'portal/weekly.html': '/portal/checkins/', 'portal/plan.html': '/portal/plan/',
  'portal/files.html': '/portal/library/', 'portal/history.html': '/portal/progress/',
};
for (const [file, to] of Object.entries(stubs)) {
  mkdirSync(join(root, file, '..'), { recursive: true });
  writeFileSync(join(root, file), `<!doctype html>
<html lang="en-IN">
<head>
<!-- @head -->
<!-- /@head -->
<title>Moved | GetFitWithPratik</title>
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
</head>
<body><p>This page has moved to <a href="${to}">${to}</a>.</p></body>
</html>
`);
}
console.log('Wrote portal, admin and redirect pages');
