import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { query } from './db.js';
import { authRequired, allowRoles, audit } from './middleware.js';

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,9)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 30) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf','image/jpeg','image/png','image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF, JPG, PNG and WEBP files are allowed'), ok);
  }
});
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'') || `story-${Date.now()}`;
const asBool = (v) => v === true || v === 'true';
const num = (v) => Number.parseInt(v, 10) || 0;
const clean = (v, max = 10000) => String(v ?? '').trim().slice(0,max);
const publicUser = (u) => ({ id:u.id, name:u.name, email:u.email, role:u.role, active:u.active, created_at:u.created_at });

// Auth
router.post('/auth/login', async (req,res,next) => {
  try {
    const email = clean(req.body.email,190).toLowerCase();
    const user = (await query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    if (!user || !user.active || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error:'Invalid email or password' });
    const token = jwt.sign({ id:user.id, name:user.name, email:user.email, role:user.role }, process.env.JWT_SECRET, { expiresIn:'10h' });
    await audit({user,ip:req.ip}, 'login', 'user', user.id);
    res.json({ token, user:publicUser(user) });
  } catch(e) { next(e); }
});
router.get('/auth/me', authRequired, async (req,res,next) => {
  try {
    const user = (await query('SELECT id,name,email,role,active,created_at FROM users WHERE id=$1',[req.user.id])).rows[0];
    if (!user || !user.active) return res.status(401).json({error:'User inactive'});
    res.json({user});
  } catch(e) { next(e); }
});

// Dashboard
router.get('/dashboard', authRequired, async (req,res,next) => {
  try {
    const [articles, editions, ads, leads, recent, adPerf] = await Promise.all([
      query(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE status='published')::int published, COUNT(*) FILTER(WHERE status='in_review')::int review FROM articles`),
      query(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE edition_date=CURRENT_DATE)::int today, COUNT(*) FILTER(WHERE status='published')::int published FROM editions`),
      query(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE status='active')::int active, COALESCE(SUM(impressions),0)::int impressions, COALESCE(SUM(clicks),0)::int clicks FROM ads`),
      query(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE status='new')::int new FROM leads`),
      query(`SELECT id,title,status,created_at,'article' AS kind FROM articles ORDER BY created_at DESC LIMIT 5`),
      query(`SELECT id,title,impressions,clicks FROM ads ORDER BY created_at DESC LIMIT 5`)
    ]);
    res.json({articles:articles.rows[0],editions:editions.rows[0],ads:ads.rows[0],leads:leads.rows[0],recent:recent.rows,adPerformance:adPerf.rows});
  } catch(e) { next(e); }
});

// Articles
router.get('/articles', authRequired, async (req,res,next) => {
  try {
    const term = `%${clean(req.query.search,120)}%`;
    const status = clean(req.query.status,30);
    const params = [term];
    let where = `(title ILIKE $1 OR category ILIKE $1 OR summary ILIKE $1)`;
    if (status) { params.push(status); where += ` AND status=$${params.length}`; }
    const rows = await query(`SELECT a.*,u.name AS author_name FROM articles a LEFT JOIN users u ON u.id=a.author_id WHERE ${where} ORDER BY a.updated_at DESC LIMIT 300`,params);
    res.json({data:rows.rows});
  } catch(e) { next(e); }
});
router.post('/articles', authRequired, allowRoles('admin','editor','reporter'), async (req,res,next) => {
  try {
    const title=clean(req.body.title,300);
    if (!title) return res.status(400).json({error:'Title is required'});
    const status = ['draft','in_review'].includes(req.body.status) ? req.body.status : 'draft';
    const row=(await query(`INSERT INTO articles(title,slug,summary,body,category,language,author_id,status,featured_image_url)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title,slugify(title),clean(req.body.summary),clean(req.body.body,50000),clean(req.body.category,100)||'General',clean(req.body.language,30)||'Kannada',req.user.id,status,clean(req.body.featured_image_url,1000)])).rows[0];
    await audit(req,'create','article',row.id,{title});
    res.status(201).json({data:row});
  } catch(e) { next(e); }
});
router.put('/articles/:id', authRequired, allowRoles('admin','editor','reporter'), async (req,res,next) => {
  try {
    const old=(await query('SELECT * FROM articles WHERE id=$1',[req.params.id])).rows[0];
    if (!old) return res.status(404).json({error:'Article not found'});
    if (req.user.role==='reporter' && old.author_id!==req.user.id) return res.status(403).json({error:'Reporters can edit only their own stories'});
    const title=clean(req.body.title,300)||old.title;
    let status = ['draft','in_review','approved','published','rejected'].includes(req.body.status) ? req.body.status : old.status;
    if (req.user.role==='reporter' && ['approved','published'].includes(status)) status='in_review';
    if (req.user.role==='editor' && status==='published' && old.status!=='approved' && old.status!=='published') return res.status(400).json({error:'Approve the article before publishing'});
    const row=(await query(`UPDATE articles SET title=$1,slug=$2,summary=$3,body=$4,category=$5,language=$6,status=$7,featured_image_url=$8,
      published_at=CASE WHEN $7='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_at=NOW()
      WHERE id=$9 RETURNING *`,
      [title,slugify(title),clean(req.body.summary),clean(req.body.body,50000),clean(req.body.category,100)||'General',clean(req.body.language,30)||'Kannada',status,clean(req.body.featured_image_url,1000),req.params.id])).rows[0];
    await audit(req,'update','article',row.id,{status});
    res.json({data:row});
  } catch(e) { next(e); }
});
router.delete('/articles/:id', authRequired, allowRoles('admin','editor'), async (req,res,next) => {
  try { const r=await query('DELETE FROM articles WHERE id=$1 RETURNING id,title',[req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Article not found'}); await audit(req,'delete','article',req.params.id); res.json({ok:true}); } catch(e){next(e);}
});

// Editions
router.get('/editions', authRequired, async (req,res,next) => {
  try { const r=await query(`SELECT e.*,u.name AS creator_name FROM editions e LEFT JOIN users u ON u.id=e.created_by ORDER BY edition_date DESC,created_at DESC LIMIT 300`); res.json({data:r.rows}); } catch(e){next(e);}
});
router.post('/editions', authRequired, allowRoles('admin','editor'), async (req,res,next) => {
  try {
    const title=clean(req.body.title,240); const date=clean(req.body.edition_date,10);
    if(!title||!date)return res.status(400).json({error:'Title and edition date are required'});
    const r=await query(`INSERT INTO editions(title,edition_date,edition_type,status,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title,date,clean(req.body.edition_type,80)||'Daily',['draft','ready','published','archived'].includes(req.body.status)?req.body.status:'draft',clean(req.body.notes),req.user.id]);
    await audit(req,'create','edition',r.rows[0].id,{title,date}); res.status(201).json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.post('/editions/:id/pdf', authRequired, allowRoles('admin','editor'), upload.single('pdf'), async (req,res,next) => {
  try {
    if(!req.file)return res.status(400).json({error:'PDF file is required'});
    if(path.extname(req.file.originalname).toLowerCase()!=='.pdf'){fs.unlinkSync(req.file.path);return res.status(400).json({error:'Upload a PDF file'});}
    const r=await query(`UPDATE editions SET pdf_path=$1,original_filename=$2,status=CASE WHEN status='draft' THEN 'ready' ELSE status END,updated_at=NOW() WHERE id=$3 RETURNING *`,
      [`/uploads/${req.file.filename}`,req.file.originalname,req.params.id]);
    if(!r.rowCount){fs.unlinkSync(req.file.path);return res.status(404).json({error:'Edition not found'});}
    await audit(req,'upload_pdf','edition',req.params.id,{filename:req.file.originalname}); res.json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.put('/editions/:id', authRequired, allowRoles('admin','editor'), async (req,res,next) => {
  try {
    const status=['draft','ready','published','archived'].includes(req.body.status)?req.body.status:null;
    const old=(await query('SELECT * FROM editions WHERE id=$1',[req.params.id])).rows[0]; if(!old)return res.status(404).json({error:'Edition not found'});
    const nextStatus=status||old.status;
    const r=await query(`UPDATE editions SET title=$1,edition_date=$2,edition_type=$3,status=$4,notes=$5,published_at=CASE WHEN $4='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_at=NOW() WHERE id=$6 RETURNING *`,
      [clean(req.body.title,240)||old.title,clean(req.body.edition_date,10)||old.edition_date,clean(req.body.edition_type,80)||old.edition_type,nextStatus,clean(req.body.notes),req.params.id]);
    await audit(req,'update','edition',req.params.id,{status:nextStatus}); res.json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.delete('/editions/:id', authRequired, allowRoles('admin'), async (req,res,next) => {
  try { const r=await query('DELETE FROM editions WHERE id=$1 RETURNING id',[req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Edition not found'}); await audit(req,'delete','edition',req.params.id); res.json({ok:true}); } catch(e){next(e);}
});

// Ads
router.get('/ads', authRequired, async (req,res,next) => {
  try { const r=await query('SELECT * FROM ads ORDER BY created_at DESC LIMIT 300'); res.json({data:r.rows}); } catch(e){next(e);}
});
router.post('/ads', authRequired, allowRoles('admin','editor','ad_manager'), async (req,res,next) => {
  try {
    const advertiser=clean(req.body.advertiser_name,200), title=clean(req.body.title,250);
    if(!advertiser||!title)return res.status(400).json({error:'Advertiser and ad title are required'});
    const status=['draft','scheduled','active','paused','completed'].includes(req.body.status)?req.body.status:'draft';
    const r=await query(`INSERT INTO ads(advertiser_name,title,category,placement,image_url,target_url,contact_name,contact_phone,starts_at,ends_at,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [advertiser,title,clean(req.body.category,100)||'Local Business',clean(req.body.placement,100)||'Homepage banner',clean(req.body.image_url,1000),clean(req.body.target_url,1000),clean(req.body.contact_name,160),clean(req.body.contact_phone,60),req.body.starts_at||null,req.body.ends_at||null,status]);
    await audit(req,'create','ad',r.rows[0].id,{title,advertiser}); res.status(201).json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.put('/ads/:id', authRequired, allowRoles('admin','editor','ad_manager'), async (req,res,next) => {
  try {
    const old=(await query('SELECT * FROM ads WHERE id=$1',[req.params.id])).rows[0]; if(!old)return res.status(404).json({error:'Ad not found'});
    const status=['draft','scheduled','active','paused','completed'].includes(req.body.status)?req.body.status:old.status;
    const r=await query(`UPDATE ads SET advertiser_name=$1,title=$2,category=$3,placement=$4,image_url=$5,target_url=$6,contact_name=$7,contact_phone=$8,starts_at=$9,ends_at=$10,status=$11,updated_at=NOW() WHERE id=$12 RETURNING *`,
      [clean(req.body.advertiser_name,200)||old.advertiser_name,clean(req.body.title,250)||old.title,clean(req.body.category,100)||old.category,clean(req.body.placement,100)||old.placement,clean(req.body.image_url,1000),clean(req.body.target_url,1000),clean(req.body.contact_name,160),clean(req.body.contact_phone,60),req.body.starts_at||null,req.body.ends_at||null,status,req.params.id]);
    await audit(req,'update','ad',req.params.id,{status}); res.json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.delete('/ads/:id', authRequired, allowRoles('admin','editor'), async (req,res,next) => {
  try { const r=await query('DELETE FROM ads WHERE id=$1 RETURNING id',[req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Ad not found'}); await audit(req,'delete','ad',req.params.id); res.json({ok:true}); } catch(e){next(e);}
});
router.post('/ads/:id/event', async (req,res,next) => {
  try {
    const type=req.body.type;
    if(!['impression','click'].includes(type))return res.status(400).json({error:'Event type must be impression or click'});
    const field=type==='impression'?'impressions':'clicks';
    const r=await query(`UPDATE ads SET ${field}=${field}+1 WHERE id=$1 AND status='active' AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) RETURNING id`,[req.params.id]);
    res.json({tracked:!!r.rowCount});
  } catch(e){next(e);}
});

// Public lead capture endpoint. Explicit consent is mandatory.
router.post('/public/leads', async (req,res,next) => {
  try {
    const name=clean(req.body.name,160), phone=clean(req.body.phone,60);
    if(!name||!phone)return res.status(400).json({error:'Name and phone are required'});
    if(!asBool(req.body.consent))return res.status(400).json({error:'Consent is required before sharing enquiry details'});
    const adId=req.body.advertiser_id ? num(req.body.advertiser_id) : null;
    const r=await query(`INSERT INTO leads(advertiser_id,name,phone,email,message,consent,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at`,
      [adId,name,phone,clean(req.body.email,190),clean(req.body.message,3000),true,clean(req.body.source,120)||'website']);
    res.status(201).json({ok:true,lead:r.rows[0]});
  } catch(e){next(e);}
});
// Leads
router.get('/leads', authRequired, allowRoles('admin','editor','ad_manager'), async (req,res,next) => {
  try { const r=await query(`SELECT l.*,a.title AS ad_title,a.advertiser_name FROM leads l LEFT JOIN ads a ON a.id=l.advertiser_id ORDER BY l.created_at DESC LIMIT 500`); res.json({data:r.rows}); } catch(e){next(e);}
});
router.put('/leads/:id', authRequired, allowRoles('admin','editor','ad_manager'), async (req,res,next) => {
  try { const status=['new','contacted','qualified','closed','spam'].includes(req.body.status)?req.body.status:'new'; const r=await query('UPDATE leads SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Lead not found'}); await audit(req,'update','lead',req.params.id,{status}); res.json({data:r.rows[0]}); } catch(e){next(e);}
});

// Users
router.get('/users', authRequired, allowRoles('admin'), async (_req,res,next) => {
  try { const r=await query('SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at DESC'); res.json({data:r.rows}); } catch(e){next(e);}
});
router.post('/users', authRequired, allowRoles('admin'), async (req,res,next) => {
  try {
    const name=clean(req.body.name,160),email=clean(req.body.email,190).toLowerCase(),password=String(req.body.password||'');
    const role=['admin','editor','reporter','ad_manager'].includes(req.body.role)?req.body.role:'editor';
    if(!name||!email||password.length<10)return res.status(400).json({error:'Name, email and password (minimum 10 characters) are required'});
    const hash=await bcrypt.hash(password,12);
    const r=await query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,active,created_at',[name,email,hash,role]);
    await audit(req,'create','user',r.rows[0].id,{email,role}); res.status(201).json({data:r.rows[0]});
  } catch(e){if(e.code==='23505')return res.status(409).json({error:'Email already exists'});next(e);}
});
router.put('/users/:id', authRequired, allowRoles('admin'), async (req,res,next) => {
  try {
    if(Number(req.params.id)===req.user.id && req.body.active===false)return res.status(400).json({error:'You cannot deactivate your own account'});
    const role=['admin','editor','reporter','ad_manager'].includes(req.body.role)?req.body.role:null;
    const r=await query(`UPDATE users SET name=COALESCE(NULLIF($1,''),name),role=COALESCE($2,role),active=COALESCE($3,active) WHERE id=$4 RETURNING id,name,email,role,active,created_at`,
      [clean(req.body.name,160),role,typeof req.body.active==='boolean'?req.body.active:null,req.params.id]);
    if(!r.rowCount)return res.status(404).json({error:'User not found'});
    await audit(req,'update','user',req.params.id,{role:r.rows[0].role,active:r.rows[0].active}); res.json({data:r.rows[0]});
  } catch(e){next(e);}
});
router.post('/users/:id/reset-password', authRequired, allowRoles('admin'), async (req,res,next) => {
  try {
    const password=String(req.body.password||''); if(password.length<10)return res.status(400).json({error:'Password must be at least 10 characters'});
    const hash=await bcrypt.hash(password,12); const r=await query('UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id',[hash,req.params.id]);
    if(!r.rowCount)return res.status(404).json({error:'User not found'}); await audit(req,'reset_password','user',req.params.id); res.json({ok:true});
  } catch(e){next(e);}
});

// Reports and audit
router.get('/reports/leads.csv', authRequired, allowRoles('admin','editor','ad_manager'), async (_req,res,next) => {
  try {
    const r=await query(`SELECT l.id,l.name,l.phone,l.email,l.message,l.consent,l.source,l.status,l.created_at,a.advertiser_name,a.title AS ad_title FROM leads l LEFT JOIN ads a ON a.id=l.advertiser_id ORDER BY l.created_at DESC`);
    const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    res.type('text/csv').attachment('vachana-leads.csv').send([Object.keys(r.rows[0]||{id:'',name:'',phone:'',email:'',message:'',consent:'',source:'',status:'',created_at:'',advertiser_name:'',ad_title:''}).join(','),...r.rows.map(row=>Object.values(row).map(esc).join(','))].join('\n'));
  } catch(e){next(e);}
});
router.get('/reports/ads.csv', authRequired, allowRoles('admin','editor','ad_manager'), async (_req,res,next) => {
  try { const r=await query('SELECT id,advertiser_name,title,category,placement,status,impressions,clicks,starts_at,ends_at,created_at FROM ads ORDER BY created_at DESC'); const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`; res.type('text/csv').attachment('vachana-ads.csv').send([Object.keys(r.rows[0]||{id:'',advertiser_name:'',title:'',category:'',placement:'',status:'',impressions:'',clicks:'',starts_at:'',ends_at:'',created_at:''}).join(','),...r.rows.map(row=>Object.values(row).map(esc).join(','))].join('\n')); } catch(e){next(e);}
});
router.get('/audit', authRequired, allowRoles('admin','editor'), async (_req,res,next) => {
  try { const r=await query(`SELECT a.*,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 300`); res.json({data:r.rows}); } catch(e){next(e);}
});
export default router;
