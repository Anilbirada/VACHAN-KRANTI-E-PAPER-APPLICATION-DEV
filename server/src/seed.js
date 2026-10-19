import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';
import dotenv from 'dotenv';
dotenv.config();
try {
  const email='admin@vachanakranti.local';
  const existing=await query('SELECT id FROM users WHERE email=$1',[email]);
  if(!existing.rowCount){
    const hash=await bcrypt.hash('ChangeMe@123',12);
    await query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)', ['Vachana Admin',email,hash,'admin']);
    console.log('Seeded admin@vachanakranti.local / ChangeMe@123');
  } else console.log('Seed admin already exists; no changes made.');
} catch(e){console.error(e);process.exitCode=1;} finally {await pool.end();}
