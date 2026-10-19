import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from './db.js';
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
try {
  await pool.query(sql);
  console.log('Database schema initialized.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
