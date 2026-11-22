import mysql from 'mysql2/promise';

async function seed() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'alumn_main_db_v2'
  });

  const [pkgs] = await conn.execute('SELECT count(*) as c FROM packages');
  if (pkgs[0].c === 0) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(`
      INSERT INTO packages (name, slug, alumni_limit, custom_domain, event_limit, monthly_price, yearly_price, status, is_default, is_trail, created_at, updated_at)
      VALUES 
      ('Starter Plan', 'starter-plan', 500, 0, 5, 0.00, 0.00, 1, 1, 1, ?, ?),
      ('Standard Plan', 'standard-plan', 5000, 1, 25, 49.00, 499.00, 1, 0, 0, ?, ?),
      ('Enterprise / University Plan', 'enterprise-plan', 50000, 1, 100, 99.00, 999.00, 1, 0, 0, ?, ?)
    `, [now, now, now, now, now, now]);
    console.log('Seeded packages.');
  }

  // Check email templates
  const [tmpl] = await conn.execute('SELECT count(*) as c FROM subscription_email_templates');
  if (tmpl[0].c === 0) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(`
      INSERT INTO subscription_email_templates (category, slug, subject, body, status, created_at, updated_at)
      VALUES
      ('Registration', 'welcome-email', 'Welcome to Alumni Portal', 'Dear {{name}}, Welcome to our Alumni Community!', 1, ?, ?),
      ('Subscription', 'payment-success', 'Subscription Payment Successful', 'Your subscription package {{package}} is active.', 1, ?, ?),
      ('Event', 'ticket-confirmation', 'Event Ticket Confirmation', 'Your ticket for {{event_name}} is confirmed.', 1, ?, ?)
    `, [now, now, now, now, now, now]);
    console.log('Seeded email templates.');
  }

  // Check currencies
  const [cur] = await conn.execute('SELECT count(*) as c FROM currencies');
  if (cur[0].c === 0) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(`
      INSERT INTO currencies (currency_code, symbol, currency_placement, current_currency, created_at, updated_at)
      VALUES
      ('USD', '$', 'before', 'yes', ?, ?),
      ('BDT', '৳', 'before', 'no', ?, ?)
    `, [now, now, now, now]);
    console.log('Seeded currencies.');
  }

  await conn.end();
  console.log('Done check & seed.');
}

seed().catch(console.error);

async function seedMembership() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'alumn_main_db_v2'
  });
  const [plans] = await conn.execute('SELECT count(*) as c FROM membership_plans');
  if (plans[0].c === 0) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(`
      INSERT INTO membership_plans (tenant_id, title, slug, badge, price, duration_type, duration, status, created_at, updated_at)
      VALUES 
      (1, 'Lifetime Member', 'lifetime-member', 1, 10000.00, 3, 100, 1, ?, ?),
      (1, 'Annual General Member', 'annual-general-member', 1, 2000.00, 2, 1, 1, ?, ?),
      (1, 'Associate Member', 'associate-member', 1, 1000.00, 2, 1, 1, ?, ?)
    `, [now, now, now, now, now, now]);
    console.log('Seeded membership plans');
  }
  await conn.end();
}
seedMembership().catch(console.error);
