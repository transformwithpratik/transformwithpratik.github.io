// Branded email templates. Every value from the database is escaped before it goes into HTML.
type Data = Record<string, unknown>;

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const firstRaw = (name: unknown) => String(name ?? '').trim().split(/\s+/)[0] || 'there';
const first = (name: unknown) => esc(firstRaw(name));
const str = (v: unknown) => String(v ?? '');
const LABEL: Record<string, string> = {
  fat_loss: 'Fat loss', muscle_gain: 'Muscle gain', recomposition: 'Body recomposition', strength: 'Strength', general_fitness: 'General fitness',
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', gym: 'Gym', home: 'Home', both: 'Gym and home', outdoors: 'Outdoors',
  vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', non_vegetarian: 'Non-vegetarian', vegan: 'Vegan', jain: 'Jain',
};
const lbl = (v: unknown) => LABEL[String(v)] ?? String(v ?? '');
// Wraps HTML we built ourselves so rows() inserts it as-is; everything else is escaped.
const trusted = (html: string) => ({ __html: html });
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');

function layout(site: string, title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#ECECE4;font-family:Arial,Helvetica,sans-serif;color:#171A18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECECE4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;overflow:hidden">
<tr><td style="background:#171A18;padding:18px 24px"><span style="font-size:18px;font-weight:800;color:#F5F5F0">GetFitWith<span style="color:#B8F36B">Pratik</span></span></td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#171A18">${esc(title)}</h1>${body}</td></tr>
${cta ? `<tr><td style="padding:8px 24px 28px"><a href="${esc(cta.href)}" style="display:inline-block;background:#B8F36B;color:#171A18;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : '<tr><td style="padding:0 24px 20px"></td></tr>'}
<tr><td style="padding:16px 24px;border-top:1px solid #E2E3D9;font-size:12px;color:#5E645C">GetFitWithPratik · <a href="${esc(site)}" style="color:#55622B">${esc(site.replace(/^https?:\/\//, ''))}</a><br>You get this email because of your account or enquiry. Clients can turn off notification emails in their portal profile.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${s}</p>`;
function rows(pairs: [string, unknown][]) {
  const r = pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<tr><td style="padding:6px 10px 6px 0;color:#5E645C;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:14px;white-space:pre-wrap">${v && typeof v === 'object' && '__html' in (v as object) ? (v as { __html: string }).__html : esc(v)}</td></tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;border-collapse:collapse">${r}</table>`;
}
function wa(num: unknown, text: string) {
  const d = String(num ?? '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}`;
}

export function render(template: string, d: Data, site: string): { html: string; text: string } {
  const admin = `${site}/admin/`;
  const portal = `${site}/portal/`;
  let title = ''; let body = ''; let cta: { href: string; label: string } | undefined;
  switch (template) {
    case 'coach_new_lead': {
      title = `New enquiry from ${str(d.name)}`;
      const link = wa(d.whatsapp, `Hi ${String(d.name ?? '').split(' ')[0]}, this is Pratik from GetFitWithPratik. Thanks for your enquiry!`);
      body = rows([
        ['Email', d.email], ['WhatsApp', link ? trusted(`<a href="${esc(link)}">${esc(d.whatsapp)}</a>`) : d.whatsapp], ['Goal', lbl(d.goal)],
        ['Age', d.age], ['Height', d.height_cm ? `${d.height_cm} cm` : ''], ['Weight', d.weight_kg ? `${d.weight_kg} kg` : ''], ['Target', d.target_weight_kg ? `${d.target_weight_kg} kg` : ''],
        ['Experience', d.experience ? lbl(d.experience) : ''], ['Trains at', d.workout_location ? lbl(d.workout_location) : ''], ['Diet', d.diet_preference ? lbl(d.diet_preference) : ''],
        ['Allergies', d.allergies], ['Work schedule', d.work_schedule], ['Availability', d.availability], ['Challenge', d.biggest_challenge],
        ['Medical', d.medical_notes], ['Plan interest', d.plan_interest], ['Start', d.start_date ? fmtDate(d.start_date) : ''], ['Message', d.message], ['Source', d.source],
      ]);
      cta = { href: `${admin}#lead/${d.id}`, label: 'Open in dashboard' };
      break;
    }
    case 'lead_ack':
      title = `Thanks, ${firstRaw(d.name)}. I have your details.`;
      body = p('I read every enquiry myself and will reply within 24 hours on WhatsApp or email to set up a short consult call.')
        + p('On the call we will talk about your goal, your weekly schedule, the food you like and anything that has got in the way before. There is no pressure to sign up.')
        + p(`While you wait, you can work out your starting numbers with the <a href="${site}/calculator" style="color:#55622B">calorie calculator</a> or try a few <a href="${site}/nutrition" style="color:#55622B">high-protein recipes</a>.`)
        + p('Talk soon,<br>Pratik');
      break;
    case 'coach_new_registration':
      title = `New account: ${str(d.name || d.email)}`;
      body = p(d.status === 'active' ? 'This email was pre-approved, so the account is already active.' : 'The account is waiting for your approval.') + rows([['Email', d.email]]);
      cta = { href: `${admin}#client/${d.id}`, label: d.status === 'active' ? 'Open client' : 'Review and approve' };
      break;
    case 'client_registration':
      title = `Thanks for signing up, ${firstRaw(d.name)}`;
      body = p('Your account is created. I approve every client account personally, usually within a day of our consult call. You will get another email when your portal is ready.')
        + p('If we have not spoken yet, reply to this email or send your details through the website so we can set up a call.');
      cta = { href: `${site}/book`, label: 'Send my details' };
      break;
    case 'client_welcome_active':
    case 'client_approved':
      title = `You're in, ${firstRaw(d.name)}. Your portal is ready.`;
      body = p('Your coaching account is active. Here is how to get started:')
        + `<ol style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7"><li>Log in and add your current weight under Progress.</li><li>Check My plan for your targets (I may still be finishing it).</li><li>Log your food and training each day. It takes a couple of minutes.</li><li>Submit your weekly check-in on your check-in day.</li></ol>`;
      cta = { href: `${portal}login/`, label: 'Open my portal' };
      break;
    case 'coach_client_approved':
      title = `Approved: ${str(d.name || d.email)}`;
      body = p('A welcome email has gone to the client. Next: set their targets and plans.');
      break;
    case 'coach_new_checkin':
      title = `Check-in from ${str(d.name)}`;
      body = rows([['Week of', fmtDate(d.week_of)], ['Weight', d.weight_kg ? `${d.weight_kg} kg` : ''], ['Training', d.workout_adherence != null ? `${d.workout_adherence}%` : ''], ['Nutrition', d.nutrition_adherence != null ? `${d.nutrition_adherence}%` : ''], ['Sleep', d.sleep_hours ? `${d.sleep_hours} h` : ''], ['Energy', d.energy ? `${d.energy}/5` : ''], ['Hunger', d.hunger ? `${d.hunger}/5` : ''], ['Stress', d.stress ? `${d.stress}/5` : ''], ['Challenges', d.challenges], ['Message', d.coach_message]]);
      cta = { href: `${admin}#client/${d.client_id}/checkins`, label: 'Review check-in' };
      break;
    case 'client_coach_feedback':
      title = `New feedback on your check-in, ${firstRaw(d.name)}`;
      body = `<div style="margin:0 0 16px;padding:14px 16px;background:#F5F5F0;border-left:4px solid #B8F36B;border-radius:6px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(d.body)}</div>`;
      cta = { href: `${portal}checkins/`, label: 'Read in the portal' };
      break;
    case 'client_plan_updated':
      title = `Your ${str(d.what || 'plan')} has been updated`;
      body = p(`Hi ${first(d.name)}, I have made changes to your ${esc(d.what || 'plan')}. Take a look before your next session or meal.`);
      cta = { href: `${portal}plan/`, label: 'View my plan' };
      break;
    case 'coach_plan_updated':
      title = `Plan updated for ${str(d.name)}`;
      body = p(`You updated their ${esc(d.what)}. They have been notified.`);
      cta = { href: `${admin}#client/${d.client_id}/plan`, label: 'Open plan' };
      break;
    case 'client_checkin_reminder':
      title = `Your weekly check-in is due today, ${firstRaw(d.name)}`;
      body = p('It takes about five minutes: your weight, how training and food went, sleep, energy and anything you want me to know. I review every check-in and reply with feedback.');
      cta = { href: `${portal}checkins/`, label: 'Do my check-in' };
      break;
    case 'client_checkin_missed':
      title = `We missed your check-in this week, ${firstRaw(d.name)}`;
      body = p('No problem, weeks get busy. A quick check-in, even a partial one, helps me keep your plan on track. If something came up, tell me in the message box.');
      cta = { href: `${portal}checkins/`, label: 'Check in now' };
      break;
    case 'coach_missed_checkins':
      title = 'Missed check-ins this week';
      body = p('These clients have not checked in two days after their check-in day:') + `<p style="white-space:pre-wrap;font-size:15px">${esc(d.names)}</p>`;
      cta = { href: `${admin}#clients/active`, label: 'Open clients' };
      break;
    case 'client_renewal_reminder':
      title = `Your coaching plan ends on ${fmtDate(d.plan_end)}`;
      body = p(`Hi ${first(d.name)}, your ${esc(d.plan_name || 'coaching plan')} ends in ${esc(d.days_left)} day${Number(d.days_left) === 1 ? '' : 's'}. If you would like to continue, reply to this email or message me and we will plan your next block.`);
      cta = { href: `${portal}profile/`, label: 'View my plan details' };
      break;
    case 'coach_renewal_due':
      title = `Renewal due: ${str(d.name)}`;
      body = rows([['Plan', d.plan_name], ['Ends', fmtDate(d.plan_end)], ['Days left', d.days_left]]);
      cta = { href: `${admin}#client/${d.client_id}/payments`, label: 'Open client' };
      break;
    case 'test':
      title = 'Your coaching platform can send email';
      body = p(`This is a test${d.sent_by ? ` sent by ${esc(d.sent_by)}` : ''}. New enquiries, sign-ups, check-ins and reminders will arrive like this.`);
      cta = { href: admin, label: 'Open dashboard' };
      break;
    default:
      title = 'Update from GetFitWithPratik';
      body = p('There is an update in your portal.');
      cta = { href: portal, label: 'Open portal' };
  }
  const html = layout(site, title, body, cta);
  const decode = (x: string) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const bodyText = decode(body.replace(/<br>/g, '\n').replace(/<\/td>\s*<td[^>]*>/g, ': ').replace(/<\/(p|tr|li|div)>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
  const text = `${title}\n\n${bodyText}${cta ? `\n\n${cta.label}: ${cta.href}` : ''}\n\nGetFitWithPratik · ${site}`;
  return { html, text };
}
