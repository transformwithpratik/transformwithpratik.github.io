// Interaction flows: forms submit, data lands in the (fake) database, and the UI reflects it.
import { join } from 'node:path';

export default async function flows(t) {
  const { suite, newContext, watch, settle, checkLayout, fail, BASE, backend, shots, ADMIN, CLIENT } = t;
  const db = backend.db;
  const count = (table, pred = () => true) => db.table(table).filter(pred).length;
  const today = new Date().toISOString().slice(0, 10);
  const expect = (cond, where, msg) => { if (!cond) fail(where, msg); };
  const errorsOf = (page) => page.$$eval('.field-error', (els) => els.map((e) => e.textContent.trim()).filter(Boolean));

  async function page390() {
    const ctx = await newContext(390);
    const page = await ctx.newPage();
    watch(page);
    return { ctx, page };
  }
  const issuesSince = (page, n, where) => page.__issues.slice(n).forEach((i) => fail(where, i));

  await suite('flow: mobile menu', async () => {
    const { ctx, page } = await page390();
    await page.goto(`${BASE}/`); await settle(page);
    await page.click('[data-menu-open]');
    expect(await page.isVisible('#mobile-nav'), 'menu', 'mobile menu did not open');
    expect(await page.getAttribute('[data-menu-open]', 'aria-expanded') === 'true', 'menu', 'aria-expanded not set');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(!(await page.isVisible('#mobile-nav')), 'menu', 'Escape did not close the menu');
    await ctx.close();
  });

  await suite('flow: calculator', async () => {
    const { ctx, page } = await page390();
    const where = 'calculator';
    await page.goto(`${BASE}/calculator/`); await settle(page);
    expect(!(await page.isVisible('#panel-calories [data-height-imperial]')), where, 'imperial height fields visible in metric mode');
    await page.click('#calcForm button[type=submit]');
    expect((await errorsOf(page)).length >= 3, where, 'empty submit did not show validation errors');
    await page.check('#calcForm input[name=sex][value=male]', { force: true });
    await page.fill('#c-age', '32');
    await page.fill('#c-weight', '82');
    await page.fill('#c-height', '176');
    await page.selectOption('#c-activity', { index: 2 });
    await page.check('#calcForm input[name=goal][value=lose]', { force: true });
    await page.click('#calcForm button[type=submit]');
    await page.waitForTimeout(300);
    const res = await page.textContent('[data-result]');
    expect(/kcal/i.test(res) && /\d,\d{3}|\d{4}/.test(res), where, `no calorie result: ${res.slice(0, 120)}`);
    expect(/protein/i.test(res), where, 'no protein target in result');
    await page.screenshot({ path: join(shots, 'flow-calculator-result-390.png'), fullPage: true });
    // Switch units: values convert and imperial height fields appear.
    await page.click('[data-units=imperial]');
    await page.waitForTimeout(200);
    expect(await page.isVisible('#panel-calories [data-height-imperial]'), where, 'imperial height fields hidden in imperial mode');
    const lb = Number(await page.inputValue('#c-weight'));
    expect(lb > 175 && lb < 186, where, `82 kg converted to ${lb} lb`);
    for (const tab of ['protein', 'bmi', 'whtr', 'water']) {
      await page.click(`#tab-${tab}`);
      expect(await page.isVisible(`#panel-${tab}`), where, `${tab} tab did not open`);
    }
    await checkLayout(page, where);
    await ctx.close();
  });

  await suite('flow: booking form', async () => {
    const { ctx, page } = await page390();
    const where = 'book';
    const before = count('leads');
    const n = page.__issues.length;
    await page.goto(`${BASE}/book/`); await settle(page);
    const step2Visible = () => page.isVisible('[data-back]');
    expect(!(await step2Visible()), where, 'step 2 visible before step 1 is done');
    await page.click('[data-next]');
    expect((await errorsOf(page)).length >= 4, where, 'Continue with empty step 1 did not show errors');
    expect(!(await step2Visible()), where, 'moved to step 2 with invalid step 1');
    await page.fill('input[name=name]', 'Test Booker');
    await page.fill('input[name=email]', 'Booker@Example.com');
    await page.fill('input[name=whatsapp]', '+91 98765 43210');
    await page.fill('input[name=age]', '29');
    await page.fill('input[name=height_cm]', '172');
    await page.fill('input[name=weight_kg]', '78');
    await page.check('input[name=goal][value=fat_loss]', { force: true });
    await page.click('[data-next]');
    await page.waitForTimeout(200);
    expect(await step2Visible(), where, 'did not move to step 2');
    await page.check('input[name=workout_location][value=gym]', { force: true });
    await page.check('input[name=diet_preference][value=vegetarian]', { force: true });
    await page.fill('textarea[name=biggest_challenge]', 'Late meetings');
    await page.click('form button[type=submit]');
    await page.waitForTimeout(300);
    if (count('leads') === before) {
      expect((await errorsOf(page)).length > 0, where, 'submit without consent neither saved nor showed an error');
      await page.check('input[name=consent]', { force: true });
      await page.click('form button[type=submit]');
    }
    await page.waitForSelector('[data-success-view]:not([hidden])', { timeout: 4000 }).catch(() => {});
    expect(await page.isVisible('[data-success-view]'), where, 'success view not shown');
    const lead = db.table('leads').find((l) => l.email === 'booker@example.com');
    expect(lead && lead.goal === 'fat_loss' && lead.workout_location === 'gym' && lead.biggest_challenge === 'Late meetings', where, `lead not stored correctly: ${JSON.stringify(lead)?.slice(0, 200)}`);
    const wa = await page.$('[data-success-view] a[href*="wa.me"]');
    expect(!!wa, where, 'no WhatsApp shortcut on success view (WhatsApp number is set in fixtures)');
    await page.screenshot({ path: join(shots, 'flow-book-success-390.png'), fullPage: true });
    issuesSince(page, n, where);
    await ctx.close();
  });

  await suite('flow: feedback form', async () => {
    const { ctx, page } = await page390();
    const where = 'feedback';
    const before = count('feedback');
    await page.goto(`${BASE}/feedback/`); await settle(page);
    await page.click('form button[type=submit]');
    expect((await errorsOf(page)).length >= 1, where, 'empty submit showed no errors');
    await page.check('input[name=rating][value="5"]', { force: true });
    await page.fill('textarea[name=feedback]', 'The weekly check-ins kept me consistent.');
    await page.check('input[name=consent_public]', { force: true });
    await page.click('form button[type=submit]');
    await page.waitForSelector('[data-success-view]:not([hidden])', { timeout: 4000 }).catch(() => {});
    expect(await page.isVisible('[data-success-view]'), where, 'success view not shown');
    const row = db.table('feedback').at(-1);
    expect(count('feedback') === before + 1 && row.status === 'pending' && row.consent_public === true, where, `feedback not stored as pending: ${JSON.stringify(row).slice(0, 160)}`);
    await ctx.close();
  });

  await suite('flow: register', async () => {
    const { ctx, page } = await page390();
    const where = 'register';
    await page.goto(`${BASE}/portal/register/`); await settle(page);
    expect(!(await page.$('[data-google]')), where, 'Google button shown while the provider is disabled');
    await page.fill('#full_name', 'New Person');
    await page.fill('#email', 'new.person@example.com');
    await page.fill('#password', 'short');
    await page.fill('#password2', 'different');
    await page.click('#regForm button[type=submit]');
    expect((await errorsOf(page)).length >= 1, where, 'weak/mismatched password accepted');
    await page.fill('#password', 'a-long-password-1');
    await page.fill('#password2', 'a-long-password-1');
    await page.check('#regForm input[name=consent]', { force: true });
    await page.click('#regForm button[type=submit]');
    await page.waitForTimeout(800);
    const prof = db.table('profiles').find((p) => p.email === 'new.person@example.com');
    expect(prof && prof.status === 'pending' && prof.role === 'client', where, 'new account not created as a pending client');
    const text = await page.textContent('main, body');
    expect(/check your email|confirm/i.test(text), where, 'no "confirm your email" message after sign-up');
    await page.screenshot({ path: join(shots, 'flow-register-done-390.png'), fullPage: true });
    await ctx.close();
  });

  await suite('flow: client logging', async () => {
    const { ctx, page } = await page390();
    const where = 'client';
    await t.login(page, CLIENT);
    const n = page.__issues.length;

    // Food
    await page.goto(`${BASE}/portal/logs/`); await settle(page);
    const foodBefore = count('food_logs', (r) => r.client_id === CLIENT.id && r.log_date === today);
    await page.click('[data-add-food]');
    await page.waitForSelector('dialog[open]');
    await page.fill('#f-name', 'Paneer');
    await page.dispatchEvent('#f-name', 'change');
    await page.fill('#f-qty', '100');
    await page.fill('#f-cal', '265');
    await page.fill('#f-p', '18.3');
    await page.click('dialog [data-submit]');
    await page.waitForTimeout(500);
    expect(count('food_logs', (r) => r.client_id === CLIENT.id && r.log_date === today) === foodBefore + 1, where, 'food log not saved');
    expect(!(await page.isVisible('dialog')), where, 'food modal still open after save');
    expect((await page.textContent('[data-food]')).includes('Paneer'), where, 'saved food not shown in the list');
    await page.screenshot({ path: join(shots, 'flow-client-food-390.png'), fullPage: true });

    // Workout
    const tabs = await page.$$('[role=tab]');
    for (const tab of tabs) if (/workout/i.test(await tab.textContent())) await tab.click();
    await page.waitForTimeout(400);
    const wBefore = count('workout_logs', (r) => r.client_id === CLIENT.id);
    if (await page.$('[data-add-ex]')) {
      await page.click('[data-add-ex]');
      await page.waitForSelector('dialog[open]');
      const dlg = await page.$('dialog');
      const ex = await dlg.$('input[name=exercise]');
      if (ex) await ex.fill('Goblet squat');
      const setsEl = await dlg.$('input[name=sets]'); if (setsEl) await setsEl.fill('3');
      const repsEl = await dlg.$('input[name=reps]'); if (repsEl) await repsEl.fill('10');
      const wEl = await dlg.$('input[name=weight_kg]'); if (wEl) await wEl.fill('24');
      await page.click('dialog [data-submit]');
      await page.waitForTimeout(500);
      expect(count('workout_logs', (r) => r.client_id === CLIENT.id) > wBefore, where, 'workout log not saved');
    } else fail(where, 'workouts tab has no Add exercise button');

    // Weight
    await page.goto(`${BASE}/portal/progress/`); await settle(page);
    const pBefore = count('progress_records', (r) => r.client_id === CLIENT.id);
    await page.click('[data-add]');
    await page.waitForSelector('dialog[open]');
    const wInput = await page.$('dialog input[name=weight_kg]');
    if (wInput) await wInput.fill('79.4');
    await page.click('dialog [data-submit]');
    await page.waitForTimeout(500);
    expect(count('progress_records', (r) => r.client_id === CLIENT.id) === pBefore + 1, where, 'progress record not saved');

    // Check-in for this week
    await page.goto(`${BASE}/portal/checkins/`); await settle(page);
    const cBefore = count('weekly_checkins', (r) => r.client_id === CLIENT.id);
    if (await page.$('#ciForm')) {
      await page.fill('#ci-w', '79.4');
      await page.fill('#ci-wins', 'Trained four times');
      for (const name of ['energy', 'hunger', 'stress', 'sleep_quality']) {
        const r = await page.$(`#ciForm input[name=${name}][value="3"]`);
        if (r) await r.check({ force: true });
      }
      await page.click('#ciForm button[type=submit]');
      await page.waitForTimeout(800);
      const after = db.table('weekly_checkins').filter((r) => r.client_id === CLIENT.id);
      expect(after.length === cBefore + 1 && after.some((r) => r.wins === 'Trained four times'), where, 'check-in not saved');
      await page.screenshot({ path: join(shots, 'flow-client-checkin-390.png'), fullPage: true });
    } else fail(where, 'no check-in form on /portal/checkins/');

    // Daily checklist
    await page.goto(`${BASE}/portal/dashboard/`); await settle(page);
    await page.click('[data-quicklog]');
    await page.waitForSelector('dialog[open] input[name=steps]', { timeout: 4000 }).catch(() => {});
    const steps = await page.$('dialog input[name=steps]');
    if (steps) await steps.fill('10234');
    await page.click('dialog [data-submit]');
    await page.waitForTimeout(500);
    const dl = db.table('daily_logs').find((r) => r.client_id === CLIENT.id && r.log_date === today);
    expect(dl?.steps === 10234, where, `daily checklist steps not saved: ${dl?.steps}`);

    // Profile
    await page.goto(`${BASE}/portal/profile/`); await settle(page);
    await page.fill('#pf input[name=full_name]', 'Client Renamed');
    await page.click('#pf button[type=submit]');
    await page.waitForTimeout(500);
    expect(db.table('profiles').find((p) => p.id === CLIENT.id).full_name === 'Client Renamed', where, 'profile name not saved');

    issuesSince(page, n, where);
    await ctx.close();
  });

  await suite('flow: coach actions', async () => {
    const ctx = await newContext(1280);
    const page = await ctx.newPage();
    watch(page);
    const where = 'coach';
    await t.login(page, ADMIN);
    const n = page.__issues.length;

    // Review the pending check-in with feedback and a target change.
    await page.goto(`${BASE}/admin/#checkins`); await settle(page);
    const fbBefore = count('coach_feedback');
    const form = await page.$('form[data-fb]');
    if (form) {
      await (await form.$('textarea[name=body]')).fill('Good week. Add 10 g protein at breakfast.');
      await (await form.$('summary')).click();
      await (await form.$('input[name=protein_g]')).fill('150');
      await (await form.$('button[type=submit]')).click();
      await page.waitForTimeout(800);
      expect(count('coach_feedback') === fbBefore + 1, where, 'coach feedback not saved');
      expect(db.table('weekly_checkins').find((c) => c.id === 'wc2').status === 'reviewed', where, 'check-in not marked reviewed');
      expect(db.table('plans').find((p) => p.id === 'pl1').protein_g === 150, where, 'target change not saved');
    } else fail(where, 'no feedback form on pending check-in');

    // Approve the pending review.
    await page.goto(`${BASE}/admin/#reviews`); await settle(page);
    await page.click('[data-approve="fb2"]').catch(() => fail(where, 'no approve button for pending review'));
    await page.waitForTimeout(500);
    expect(db.table('feedback').find((f) => f.id === 'fb2').status === 'approved', where, 'review not approved');

    // Lead status and conversion.
    await page.goto(`${BASE}/admin/#lead/ld1`); await settle(page);
    await page.selectOption('#ld-status', 'contacted');
    await page.click('form[data-manage] button[type=submit]');
    await page.waitForTimeout(500);
    expect(db.table('leads').find((l) => l.id === 'ld1').status === 'contacted', where, 'lead status not saved');
    await page.click('[data-convert]');
    await page.waitForTimeout(800);
    expect(db.table('leads').find((l) => l.id === 'ld1').status === 'converted', where, 'lead not converted');
    expect(count('client_invites', (i) => i.email === 'lead@example.com') === 1, where, 'no pre-approval invite created');

    // Plan builder: edit targets.
    await page.goto(`${BASE}/admin/#client/${CLIENT.id}/plan`); await settle(page);
    const tf = await page.$('form[data-targets]');
    if (tf) {
      await (await tf.$('input[name=daily_calories]')).fill('2000');
      await (await tf.$('button[type=submit]')).click();
      await page.waitForTimeout(600);
      expect(db.table('plans').find((p) => p.client_id === CLIENT.id && p.is_active).daily_calories === 2000, where, 'targets not saved from plan builder');
    } else fail(where, 'no targets form in plan builder');

    // Site settings: WhatsApp number.
    await page.goto(`${BASE}/admin/#settings`); await settle(page);
    const cf = await page.$('form[data-key=contact]');
    if (cf) {
      await (await cf.$('input[name=whatsapp]')).fill('919812345678');
      await (await cf.$('button[type=submit]')).click();
      await page.waitForTimeout(600);
      const v = db.table('site_settings').find((s) => s.key === 'contact')?.value;
      expect(v?.whatsapp === '919812345678', where, `contact settings not saved: ${JSON.stringify(v)?.slice(0, 120)}`);
    } else fail(where, 'no contact settings form');

    issuesSince(page, n, where);
    await ctx.close();
  });
}
