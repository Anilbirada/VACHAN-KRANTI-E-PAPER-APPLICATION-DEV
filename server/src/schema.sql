CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','reporter','ad_manager')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(340) NOT NULL,
  summary TEXT DEFAULT '',
  body TEXT DEFAULT '',
  category VARCHAR(100) DEFAULT 'General',
  language VARCHAR(30) DEFAULT 'Kannada',
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','rejected')),
  featured_image_url TEXT DEFAULT '',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_created_idx ON articles(created_at DESC);
CREATE TABLE IF NOT EXISTS editions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  edition_date DATE NOT NULL,
  edition_type VARCHAR(80) DEFAULT 'Daily',
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published','archived')),
  pdf_path TEXT DEFAULT '',
  original_filename TEXT DEFAULT '',
  page_count INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ads (
  id SERIAL PRIMARY KEY,
  advertiser_name VARCHAR(200) NOT NULL,
  title VARCHAR(250) NOT NULL,
  category VARCHAR(100) DEFAULT 'Local Business',
  placement VARCHAR(100) DEFAULT 'Homepage banner',
  image_url TEXT DEFAULT '',
  target_url TEXT DEFAULT '',
  contact_name VARCHAR(160) DEFAULT '',
  contact_phone VARCHAR(60) DEFAULT '',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','paused','completed')),
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  advertiser_id INTEGER REFERENCES ads(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(60) DEFAULT '',
  email VARCHAR(190) DEFAULT '',
  message TEXT DEFAULT '',
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(120) DEFAULT 'website',
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','spam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(80) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
