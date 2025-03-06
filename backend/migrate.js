const db = require('./db');
const fs = require('fs').promises;
const path = require('path');

async function createTables() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT UNIQUE,
      photo_url TEXT,
      is_admin BOOLEAN DEFAULT FALSE
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      admin_id BIGINT REFERENCES users(id),
      user_id BIGINT REFERENCES users(id),
      position TEXT NOT NULL,
      experience INTEGER,
      description TEXT NOT NULL,
      contact TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS vacancies (
      id TEXT PRIMARY KEY,
      admin_id BIGINT REFERENCES users(id),
      company_user_id BIGINT REFERENCES users(id),
      company_name TEXT NOT NULL,
      position TEXT NOT NULL,
      description TEXT NOT NULL,
      contact TEXT NOT NULL,
      official_website TEXT,
      verified BOOLEAN DEFAULT FALSE,
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      author_user_id BIGINT REFERENCES users(id),
      target_user_id BIGINT REFERENCES users(id),
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT REFERENCES users(id),
      item_id TEXT,
      item_type TEXT CHECK (item_type IN ('job', 'vacancy')),
      PRIMARY KEY (user_id, item_id, item_type)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id BIGINT REFERENCES users(id),
      type TEXT CHECK (type IN ('position', 'company')),
      value TEXT,
      PRIMARY KEY (user_id, type, value)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS job_requirements (
      job_id TEXT REFERENCES jobs(id),
      requirement TEXT,
      PRIMARY KEY (job_id, requirement)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS job_tags (
      job_id TEXT REFERENCES jobs(id),
      tag TEXT,
      PRIMARY KEY (job_id, tag)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS job_categories (
      job_id TEXT REFERENCES jobs(id),
      category TEXT,
      PRIMARY KEY (job_id, category)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS vacancy_requirements (
      vacancy_id TEXT REFERENCES vacancies(id),
      requirement TEXT,
      PRIMARY KEY (vacancy_id, requirement)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS vacancy_tags (
      vacancy_id TEXT REFERENCES vacancies(id),
      tag TEXT,
      PRIMARY KEY (vacancy_id, tag)
    )
  `);

  await db.none(`
    CREATE TABLE IF NOT EXISTS vacancy_categories (
      vacancy_id TEXT REFERENCES vacancies(id),
      category TEXT,
      PRIMARY KEY (vacancy_id, category)
    )
  `);

  console.log('Таблицы успешно созданы');
}

async function migrateData() {
  // Миграция пользователей
  const usersData = JSON.parse(await fs.readFile(path.join(__dirname, 'users.json'), 'utf8') || '[]');
  for (const user of usersData) {
    await db.none(
      `INSERT INTO users (id, first_name, last_name, username, photo_url, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.first_name, user.last_name, user.username, user.photo_url, user.is_admin || false]
    );
  }

  // Миграция вакансий фрилансеров
  const jobsData = JSON.parse(await fs.readFile(path.join(__dirname, 'jobs.json'), 'utf8') || '[]');
  for (const job of jobsData) {
    await db.tx(async t => {
      await t.none(
        `INSERT INTO jobs (id, admin_id, user_id, position, experience, description, contact, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [job.id, job.adminId, job.userId, job.position, job.experience, job.description, job.contact, job.createdAt]
      );

      for (const req of job.requirements || []) {
        await t.none(
          `INSERT INTO job_requirements (job_id, requirement) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [job.id, req]
        );
      }

      for (const tag of job.tags || []) {
        await t.none(
          `INSERT INTO job_tags (job_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [job.id, tag]
        );
      }

      for (const cat of job.categories || []) {
        await t.none(
          `INSERT INTO job_categories (job_id, category) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [job.id, cat]
        );
      }
    });
  }

  // Миграция вакансий компаний
  const vacanciesData = JSON.parse(await fs.readFile(path.join(__dirname, 'vacancies.json'), 'utf8') || '[]');
  for (const vacancy of vacanciesData) {
    await db.tx(async t => {
      await t.none(
        `INSERT INTO vacancies (id, admin_id, company_user_id, company_name, position, description, contact, official_website, verified, photo_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [vacancy.id, vacancy.adminId, vacancy.companyUserId, vacancy.companyName, vacancy.position, vacancy.description, vacancy.contact, vacancy.officialWebsite, vacancy.verified, vacancy.photoUrl, vacancy.createdAt]
      );

      for (const req of vacancy.requirements || []) {
        await t.none(
          `INSERT INTO vacancy_requirements (vacancy_id, requirement) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [vacancy.id, req]
        );
      }

      for (const tag of vacancy.tags || []) {
        await t.none(
          `INSERT INTO vacancy_tags (vacancy_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [vacancy.id, tag]
        );
      }

      for (const cat of vacancy.categories || []) {
        await t.none(
          `INSERT INTO vacancy_categories (vacancy_id, category) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [vacancy.id, cat]
        );
      }
    });
  }

  // Миграция отзывов
  const reviewsData = JSON.parse(await fs.readFile(path.join(__dirname, 'reviews.json'), 'utf8') || '{}');
  for (const [id, review] of Object.entries(reviewsData)) {
    await db.none(
      `INSERT INTO reviews (id, text, author_user_id, target_user_id, date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, review.text, review.authorUserId, review.targetUserId, review.date || new Date().toISOString()]
    );
  }

  // Миграция избранного
  const favoritesData = JSON.parse(await fs.readFile(path.join(__dirname, 'favorites.json'), 'utf8') || '[]');
  for (const favorite of favoritesData) {
    await db.none(
      `INSERT INTO favorites (user_id, item_id, item_type)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [favorite.userId, favorite.itemId, favorite.itemType]
    );
  }

  // Миграция подписок
  const subscriptionsData = JSON.parse(await fs.readFile(path.join(__dirname, 'subscriptions.json'), 'utf8') || '{}');
  for (const [userId, subscriptions] of Object.entries(subscriptionsData)) {
    for (const subscription of subscriptions) {
      await db.none(
        `INSERT INTO subscriptions (user_id, type, value)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, subscription.type, subscription.value]
      );
    }
  }

  console.log('Данные успешно перенесены');
}

async function runMigration() {
  try {
    await createTables();
    await migrateData();
  } catch (error) {
    console.error('Ошибка миграции:', error);
  } finally {
    pgp.end();
  }
}

runMigration();