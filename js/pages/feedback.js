import { $, formToObject, showErrors, busy } from '../lib/util.js';
import { initSite } from '../lib/site.js';
import { rpc } from '../lib/rest.js';

initSite();
const form = $('#feedbackForm');
const anon = $('#f-anon');
anon.addEventListener('change', () => { $('[data-identity]').hidden = anon.checked; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formToObject(form);
  const errors = {};
  if (!d.rating) errors.rating = 'Choose a rating from 1 to 5.';
  if (!d.feedback || d.feedback.length < 10) errors.feedback = 'Write at least a sentence (10 characters).';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) errors.email = 'Enter a valid email or leave it blank.';
  if (!showErrors(form, errors)) return;
  if (d.is_anonymous) { d.name = ''; d.email = ''; }
  await busy(form.querySelector('[type="submit"]'), async () => {
    try {
      const res = await rpc('submit_feedback', { p: { ...d, rating: Number(d.rating) } });
      if (!res?.ok) { showErrors(form, res?.errors || { form: 'Something went wrong. Please try again.' }); return; }
      $('[data-form-view]').hidden = true;
      const v = $('[data-success-view]'); v.hidden = false; v.focus(); window.scrollTo({ top: 0 });
    } catch (err) {
      showErrors(form, { form: err.message });
    }
  });
});
