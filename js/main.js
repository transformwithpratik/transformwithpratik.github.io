// ============================================
// GETFITWITHPRATIK - Main JS
// ============================================

// --- Mobile menu toggle ---
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('show'));
  }

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
    reveals.forEach(r => obs.observe(r));
  }
});

// ============================================
// DATA LAYER
// All form submissions, content, and admin data
// live in localStorage for the demo.
// Wire up to Google Sheets / Supabase later.
// ============================================
const Store = {
  get(key, fallback = []) {
    try {
      const v = localStorage.getItem('gfp_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem('gfp_' + key, JSON.stringify(value));
  },
  push(key, item) {
    const arr = this.get(key, []);
    arr.unshift({ ...item, id: Date.now(), createdAt: new Date().toISOString() });
    this.set(key, arr);
    return arr;
  },
  remove(key, id) {
    const arr = this.get(key, []).filter(x => x.id !== id);
    this.set(key, arr);
    return arr;
  }
};

// ============================================
// CONFIG — fill these in after running the setup
// (see SETUP.md). Site works in demo mode if blank.
// ============================================
const CONFIG = {
  // Web3Forms key (gets you emails to your Gmail)
  // Get yours free at https://web3forms.com — no signup needed
  WEB3FORMS_KEY: '',

  // Email that submissions go to
  ADMIN_EMAIL: 'transformwithpratik@gmail.com',

  // Google Apps Script Web App URL (gets you a spreadsheet DB)
  // See SETUP.md step 3 for how to create this
  GOOGLE_SHEETS_URL: ''
};

// ============================================
// FORM HANDLER
// Fires three things in parallel:
//   1. Save to localStorage (admin dashboard backup)
//   2. Email via Web3Forms → your Gmail
//   3. Append row to Google Sheet (your "database")
// ============================================
async function submitForm(formId, storageKey) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.innerHTML = 'Sending...';
      submitBtn.disabled = true;
    }

    // Collect form data
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (data[k] !== undefined) {
        data[k] = Array.isArray(data[k]) ? [...data[k], v] : [data[k], v];
      } else {
        data[k] = v;
      }
    });

    // 1. Save locally (always works, admin dashboard reads this)
    Store.push(storageKey, data);

    // 2 & 3. Fire remote sends in parallel; don't block on either
    const tasks = [];

    // ---- Web3Forms email ----
    if (CONFIG.WEB3FORMS_KEY) {
      const subject = storageKey === 'bookings'
        ? `🔥 New Booking: ${data.name || 'Anonymous'}`
        : `★ New Feedback: ${data.name || 'Anonymous'} (${data.rating || '?'}/5)`;

      const message = Object.entries(data)
        .map(([k, v]) => `${k.toUpperCase()}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');

      const emailPayload = {
        access_key: CONFIG.WEB3FORMS_KEY,
        subject: subject,
        from_name: 'GetFitWithPratik Website',
        email: data.email || CONFIG.ADMIN_EMAIL,
        message: `New ${storageKey} submission from your website:\n\n${message}\n\n— Sent from getfitwithpratik.com`
      };

      tasks.push(
        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(emailPayload)
        }).catch(err => console.warn('Email send failed:', err))
      );
    }

    // ---- Google Sheets append ----
    if (CONFIG.GOOGLE_SHEETS_URL) {
      tasks.push(
        fetch(CONFIG.GOOGLE_SHEETS_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ type: storageKey, data, timestamp: new Date().toISOString() })
        }).catch(err => console.warn('Sheets sync failed:', err))
      );
    }

    // Wait for both (or 5s timeout, whichever comes first)
    await Promise.race([
      Promise.all(tasks),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // Show success regardless — local copy is saved
    form.style.display = 'none';
    const success = document.querySelector('.form-success');
    if (success) success.classList.add('show');
    window.scrollTo({ top: (form.offsetTop || 0) - 100, behavior: 'smooth' });
  });
}
