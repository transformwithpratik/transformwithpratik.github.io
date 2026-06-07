// ============================================================
// PORTAL SHARED — sidebar, header, toast, plan loading
// Include AFTER supabase-client.js on every portal page.
// ============================================================

const Portal = {
  currentUser: null,
  currentProfile: null,
  currentPlan: null,

  async init(activeTab = 'dashboard') {
    // Wait for supabase to be ready
    if (!supa) initSupabase();
    if (!supa) {
      document.body.innerHTML = `
        <div style="padding:4rem 2rem; text-align:center; min-height:100vh; display:flex; align-items:center; justify-content:center;">
          <div>
            <h1 style="font-family:var(--display); font-size:3rem; color:var(--yellow); margin-bottom:1rem;">Portal Not Configured</h1>
            <p style="color:var(--gray-light); margin-bottom:2rem;">The Supabase backend hasn't been connected yet. Check SETUP-V2.md.</p>
            <a href="../index.html" class="btn btn-outline">← Back to home</a>
          </div>
        </div>`;
      return false;
    }

    this.currentUser = await Auth.requireAuth();
    if (!this.currentUser) return false;

    this.currentProfile = await Auth.getProfile();
    if (!this.currentProfile) {
      this.toast('Profile load failed', 'error');
      return false;
    }

    // If admin somehow lands here, redirect them out
    if (this.currentProfile.role === 'admin') {
      window.location.href = '../pages/admin.html';
      return false;
    }

    const planResult = await DB.getActivePlan(this.currentUser.id);
    this.currentPlan = planResult.data || null;

    this.renderShell(activeTab);
    return true;
  },

  renderShell(activeTab) {
    const tabs = [
      { id: 'dashboard', label: '▦ Dashboard', href: 'dashboard.html' },
      { id: 'log',       label: '📝 Daily Log', href: 'log.html' },
      { id: 'weekly',    label: '⚖ Weekly Check-in', href: 'weekly.html' },
      { id: 'plan',      label: '📋 My Plan', href: 'plan.html' },
      { id: 'files',     label: '📁 Files & PDFs', href: 'files.html' },
      { id: 'history',   label: '📊 My History', href: 'history.html' }
    ];

    const sidebar = document.getElementById('portal-sidebar-mount');
    if (!sidebar) return;

    const initial = (this.currentProfile.full_name || 'C')[0].toUpperCase();

    sidebar.innerHTML = `
      <a href="../index.html" class="logo"><span class="logo-mark">GFP</span></a>
      <div class="portal-user-card">
        <div class="name">${this.currentProfile.full_name || 'Client'}</div>
        <div class="meta">Client · ${this.currentProfile.start_date || 'Active'}</div>
      </div>
      <ul class="portal-nav">
        ${tabs.map(t => `
          <li><a href="${t.href}" class="${t.id === activeTab ? 'active' : ''}">${t.label}</a></li>
        `).join('')}
        <li style="margin-top:2rem; border-top:1px solid var(--border); padding-top:1rem;">
          <a id="logoutBtn">⎋ Logout</a>
        </li>
      </ul>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await Auth.signOut();
      window.location.href = 'login.html';
    });
  },

  toast(msg, type = 'success') {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast ' + (type === 'error' ? 'error' : '');
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => t.classList.remove('show'), 3000);
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
};
