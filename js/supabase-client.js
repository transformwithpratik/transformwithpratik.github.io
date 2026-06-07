// ============================================================
// GETFITWITHPRATIK — Supabase Client & Helpers
// Loaded via <script> tag using the CDN build.
// ============================================================

// ---- CONFIG ----
// Fill these in from your Supabase project settings → API
// (See SETUP-V2.md for step-by-step)
const SUPABASE_CONFIG = {
  url: 'https://trerqtscrsrlcfsnfetn.supabase.co',         // e.g. 'https://abcdefgh.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZXJxdHNjcnNybGNmc25mZXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjYxNTgsImV4cCI6MjA5NjQwMjE1OH0.1h60JDQ6GJ5jRrp-VED_W4aYmZ4TmySz5nn0sr94d8g',     // the public anon key, safe to expose

  // For email/sheet integrations (kept from v1)
  web3formsKey: '',
  googleSheetsUrl: '',
  adminEmail: 'transformwithpratik@gmail.com'
};

// ---- INIT ----
let supa = null;
function initSupabase() {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    console.warn('[GFP] Supabase not configured. Running in demo mode.');
    return null;
  }
  if (!window.supabase) {
    console.error('[GFP] supabase-js not loaded.');
    return null;
  }
  supa = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return supa;
}

// ---- AUTH ----
const Auth = {
  async signUp({ email, password, fullName, phone }) {
    return supa.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role: 'client' } }
    });
  },

  async signIn(email, password) {
    return supa.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return supa.auth.signOut();
  },

  async getUser() {
    if (!supa) return null;
    const { data: { user } } = await supa.auth.getUser();
    return user;
  },

  async getProfile() {
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await supa.from('profiles').select('*').eq('id', user.id).single();
    return data;
  },

  async requireAuth(redirectIfNoneTo = '/portal/login.html') {
    const user = await this.getUser();
    if (!user) {
      window.location.href = redirectIfNoneTo;
      return null;
    }
    return user;
  },

  async requireAdmin() {
    const profile = await this.getProfile();
    if (!profile || profile.role !== 'admin') {
      window.location.href = '/pages/admin-login.html';
      return null;
    }
    return profile;
  }
};

// ---- DATA ACCESS ----
const DB = {
  // --- Profiles / clients ---
  async listClients() {
    return supa.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false });
  },
  async getProfile(id) {
    return supa.from('profiles').select('*').eq('id', id).single();
  },
  async updateProfile(id, updates) {
    return supa.from('profiles').update(updates).eq('id', id);
  },

  // --- Plans ---
  async getActivePlan(clientId) {
    return supa.from('plans').select('*').eq('client_id', clientId).eq('is_active', true).maybeSingle();
  },
  async upsertPlan(plan) {
    return supa.from('plans').upsert(plan, { onConflict: 'id' });
  },

  // --- Daily logs ---
  async getDailyLog(clientId, date) {
    return supa.from('daily_logs').select('*').eq('client_id', clientId).eq('log_date', date).maybeSingle();
  },
  async upsertDailyLog(log) {
    return supa.from('daily_logs').upsert(log, { onConflict: 'client_id,log_date' });
  },
  async listDailyLogs(clientId, limit = 30) {
    return supa.from('daily_logs').select('*').eq('client_id', clientId)
      .order('log_date', { ascending: false }).limit(limit);
  },

  // --- Weekly logs ---
  async addWeeklyLog(log) {
    return supa.from('weekly_logs').insert(log);
  },
  async listWeeklyLogs(clientId, limit = 20) {
    return supa.from('weekly_logs').select('*').eq('client_id', clientId)
      .order('log_date', { ascending: false }).limit(limit);
  },

  // --- Files ---
  async listClientFiles(clientId) {
    return supa.from('client_files').select('*').eq('client_id', clientId).order('uploaded_at', { ascending: false });
  },
  async addClientFile(file) {
    return supa.from('client_files').insert(file);
  },
  async deleteClientFile(id) {
    return supa.from('client_files').delete().eq('id', id);
  },

  // --- Public submissions ---
  async submitBooking(data) {
    return supa.from('bookings').insert({ ...data, raw_data: data });
  },
  async submitFeedback(data) {
    return supa.from('feedback').insert({ ...data, raw_data: data, rating: parseInt(data.rating) || null });
  },
  async listBookings() {
    return supa.from('bookings').select('*').order('created_at', { ascending: false });
  },
  async listFeedback() {
    return supa.from('feedback').select('*').order('created_at', { ascending: false });
  }
};

// ---- STORAGE ----
const FileStore = {
  // Upload a file. Returns signed URL or path.
  async upload(bucket, path, file) {
    const { data, error } = await supa.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (error) throw error;
    return data;
  },

  // Get a signed URL (private buckets) or public URL
  async getUrl(bucket, path, isPublic = false) {
    if (isPublic) {
      const { data } = supa.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    }
    const { data, error } = await supa.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  // Helper: upload a progress photo for current user
  async uploadProgressPhoto(file, slot = 'front') {
    const user = await Auth.getUser();
    if (!user) throw new Error('Not logged in');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}-${slot}.${ext}`;
    await this.upload('client-photos', path, file);
    return path;
  },

  // Admin: upload a plan PDF for a specific client
  async uploadClientPlan(file, clientId, title) {
    const ext = file.name.split('.').pop();
    const path = `${clientId}/${Date.now()}-${title.replace(/\s+/g, '-')}.${ext}`;
    await this.upload('client-plans', path, file);
    return path;
  }
};

// ---- LEGACY DUAL-SYNC ----
// Still send to Web3Forms (email) + Google Sheets so you have all 3 backups
async function dualSync(type, data) {
  const tasks = [];

  if (SUPABASE_CONFIG.web3formsKey) {
    const subject = type === 'bookings'
      ? `🔥 New Booking: ${data.name || 'Anonymous'}`
      : `★ New Feedback: ${data.name || 'Anonymous'} (${data.rating || '?'}/5)`;

    const message = Object.entries(data)
      .map(([k, v]) => `${k.toUpperCase()}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');

    tasks.push(
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: SUPABASE_CONFIG.web3formsKey,
          subject,
          from_name: 'GetFitWithPratik Website',
          email: data.email || SUPABASE_CONFIG.adminEmail,
          message: `New ${type} submission:\n\n${message}\n\n— Sent from getfitwithpratik.com`
        })
      }).catch(e => console.warn('Email failed:', e))
    );
  }

  if (SUPABASE_CONFIG.googleSheetsUrl) {
    tasks.push(
      fetch(SUPABASE_CONFIG.googleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ type, data, timestamp: new Date().toISOString() })
      }).catch(e => console.warn('Sheets failed:', e))
    );
  }

  await Promise.race([Promise.all(tasks), new Promise(r => setTimeout(r, 5000))]);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => initSupabase());
