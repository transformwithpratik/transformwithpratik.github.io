// Runs on 404.html (GitHub Pages serves it for any unknown path).
// 1) Sends old .html URLs to their new clean URLs.
// 2) Serves data-driven detail pages for slugs that do not have a pre-rendered file yet.
(function () {
  var p = location.pathname.replace(/\/+$/, '') || '/';
  var rest = location.search + location.hash;
  var map = {
    '/index.html': '/',
    '/pages/book.html': '/book', '/pages/calculator.html': '/calculator', '/pages/feedback.html': '/feedback',
    '/pages/transformations.html': '/transformations', '/pages/admin.html': '/admin/', '/pages/admin-login.html': '/portal/login/',
    '/portal/login.html': '/portal/login/', '/portal/signup.html': '/portal/register/', '/portal/dashboard.html': '/portal/dashboard/',
    '/portal/log.html': '/portal/logs/', '/portal/weekly.html': '/portal/checkins/', '/portal/plan.html': '/portal/plan/',
    '/portal/files.html': '/portal/library/', '/portal/history.html': '/portal/progress/', '/portal/index.html': '/portal/',
    '/admin.html': '/admin/', '/book.html': '/book', '/calculator.html': '/calculator', '/feedback.html': '/feedback',
    '/transformations.html': '/transformations', '/portal/signup': '/portal/register/', '/portal/log': '/portal/logs/',
    '/portal/weekly': '/portal/checkins/', '/portal/files': '/portal/library/', '/portal/history': '/portal/progress/'
  };
  if (map[p]) { location.replace(map[p] + rest); return; }
  var m = p.match(/^\/nutrition\/recipes\/([a-z0-9-]+)$/);
  if (m) { location.replace('/nutrition/recipe/?slug=' + m[1] + location.hash); return; }
  m = p.match(/^\/transformations\/([a-z0-9-]+)$/);
  if (m && m[1] !== 'story') { location.replace('/transformations/story/?slug=' + m[1] + location.hash); return; }
  if (/\.html$/.test(p)) { location.replace(p.replace(/\.html$/, '') + rest); }
})();
