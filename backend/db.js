const pgp = require('pg-promise')();
require('dotenv').config();

const db = pgp(process.env.DATABASE_URL || 'postgres://neondb_owner:npg_KXo7LO2juphx@ep-purple-resonance-a1th4uz9-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

module.exports = db;