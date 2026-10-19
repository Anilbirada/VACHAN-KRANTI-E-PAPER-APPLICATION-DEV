# 📰 Vachana Kranti — Enterprise Digital Publishing & E-Paper Platform

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Backend-Express.js%204-black?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2014%2B-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE.txt)

An enterprise-ready, full-stack digital newsroom and e-paper publishing platform architected for regional and mainstream daily newspaper publishers. Built with modern web standards, high-performance micro-architecture, and native Kannada Unicode (UTF-8) support.

---

## 📑 Table of Contents
- [About the Platform](#-about-the-platform)
- [System Architecture](#-system-architecture)
- [Core Features & Modules](#-core-features--modules)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Prerequisites & System Requirements](#-prerequisites--system-requirements)
- [Database Configuration & Credentials](#-database-configuration--credentials)
- [Step-by-Step Installation & Running Guide](#-step-by-step-installation--running-guide)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Configure Database](#2-configure-database)
  - [3. Backend Setup & Startup](#3-backend-setup--startup)
  - [4. Frontend Setup & Startup](#4-frontend-setup--startup)
- [Demo Admin Credentials](#-demo-admin-credentials)
- [API Reference](#-api-reference)
- [Production Deployment Recommendations](#-production-deployment-recommendations)
- [License](#-license)

---

## 💡 About the Platform

The **Vachana Kranti Digital Publishing Platform** empowers news publishing houses with an integrated digital newsroom, automated PDF e-paper edition distribution, ad campaign monetisation, lead management, and granular activity auditing.

Designed from the ground up by senior software engineers:
- **Clean separation of concerns** between presentation layer (React SPA) and business/persistence layers (Express API + PostgreSQL).
- **Zero-lag regional typography handling** supporting Kannada Unicode (UTF-8) across all headlines, body copy, and metadata without rendering artifacts or encoding corruption.
- **Auditable workflow lifecycle** for editorial teams, tracking changes from reporter draft submissions to editorial approvals.
- **Built-in Monetization & CRM engine** tracking advertisement impressions, clicks, click-through-rates (CTR), and business advertiser leads.

---

## 🏛 System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Port 5173)"]
        UI["React 18 SPA (Vite)"]
        Dashboard["Executive Dashboard & Charts (Recharts)"]
        Modules["Articles, Editions, Ads, Leads, Users"]
    end

    subgraph ReverseProxy ["Vite Reverse Proxy"]
        Proxy["/api & /uploads Reverse Proxy"]
    end

    subgraph ServerLayer ["Backend Layer (Port 4000)"]
        Express["Express.js 4 REST API"]
        AuthMiddleware["JWT Authentication & RBAC Guard"]
        UploadHandler["Multer File & PDF Upload Handler"]
        Limiter["Express Rate Limiter & Helmet Security"]
    end

    subgraph StorageLayer ["Data & Storage Layer"]
        Postgres[("PostgreSQL 14+ Database\n(Port 5432 / 5433)")]
        DiskStorage["Local File Store / Object Storage\n(/server/uploads)"]
    end

    UI --> Proxy
    Proxy --> Express
    Express --> AuthMiddleware
    AuthMiddleware --> Postgres
    Express --> UploadHandler
    UploadHandler --> DiskStorage
    Express --> Limiter
```

---

## 🌟 Core Features & Modules

### 1. 📝 Newsroom & Article Publishing Engine
- Complete CRUD operations for news articles.
- Native Kannada Unicode (UTF-8) support with full-text search capability.
- Multi-stage publication lifecycle (`draft`, `review`, `published`, `archived`).
- Category taxonomy (Karnataka, National, International, Business, Sports, Entertainment, Editorial).

### 2. 📰 E-Paper Editions & PDF Distribution
- Daily, weekly, and special editions cataloging.
- Secure multipart PDF upload via Multer with validation and safe MIME verification.
- Direct inline preview and download links for uploaded editions.

### 3. 🎯 Advertisement Campaign Manager
- Multi-slot placement support: `top_banner`, `sidebar`, `interstitial`, `in_article`, `footer`.
- Scheduling with start/end dates and budget tracking.
- Real-time impression and click event endpoints with automatic CTR calculations.
- Direct CSV export for advertisers and accounting teams.

### 4. 💼 Advertiser Lead Generation & CRM
- Capture and track prospective advertising and classified enquiries.
- Sales pipeline statuses: `new`, `contacted`, `qualified`, `proposal_sent`, `converted`, `rejected`.
- One-click CSV export for external CRM integration.

### 5. 👥 User Management & Enterprise RBAC
- Granular permissions restricting module access per team function.
- Password hashing using salted Bcrypt (`cost factor 12`).
- Stateless JSON Web Token (JWT) session authorization.

### 6. 📊 Real-Time Analytics & Audit Trail
- High-level KPIs: Active users, total articles, e-paper editions, ad impressions, active leads.
- Visual performance charts powered by Recharts.
- Immutable activity log recording all user actions, logins, updates, and deletes for compliance.

---

## 🛡 Role-Based Access Control (RBAC)

| Role | Dashboard | Articles | E-Paper Editions | Ads Manager | Leads CRM | User Management | Audit Logs | CSV Reports |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **admin** | ✅ | ✅ (All) | ✅ (Full) | ✅ (Full) | ✅ (Full) | ✅ (Full) | ✅ (Full) | ✅ (Full) |
| **editor** | ✅ | ✅ (All) | ✅ (Full) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **reporter**| ✅ | ✅ (Own) | 👁️ (View) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ad_manager**| ✅ | ❌ | ❌ | ✅ (Full) | ✅ (Full) | ❌ | ❌ | ✅ (Full) |

---

## 💻 Prerequisites & System Requirements

Ensure the following tools are installed on your workstation or server:

| Requirement | Supported Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x+` | `node -v` |
| **npm** | `v10.x+` | `npm -v` |
| **PostgreSQL** | `14.x`, `15.x`, `16.x`, or `18.x` | `psql --version` |
| **Git** | `2.x+` | `git --version` |

---

## 🗄 Database Configuration & Credentials

The platform is designed to connect to PostgreSQL. Below are the preconfigured credentials and connection strings:

### Database Details
- **Database Name:** `vachana_kranti`
- **Default Database User:** `postgres`
- **Default Database Password:** `postgres` *(or your custom PostgreSQL password)*
- **Default Port:** `5432` *(or `5433` if you are using PostgreSQL 16/18 side-by-side on Windows)*
- **Default Host:** `localhost`

### Connection String Format
```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vachana_kranti
```
*(If your PostgreSQL instance runs on port 5433, use `postgres://postgres:postgres@localhost:5433/vachana_kranti`)*

---

## 🚀 Step-by-Step Installation & Running Guide

### 1. Clone Repository
```bash
git clone https://github.com/Anilbirada/VACHAN-KRANTI-E-PAPER-APPLICATION-DEV.git
cd VACHAN-KRANTI-E-PAPER-APPLICATION-DEV
```

---

### 2. Configure Database
Open your terminal (or PostgreSQL interactive tool like `psql` or pgAdmin) and create the database:
```sql
CREATE DATABASE vachana_kranti;
```

---

### 3. Backend Setup & Startup

#### Step 3.1: Navigate into the server directory
```bash
cd server
```

#### Step 3.2: Configure Environment Variables
Create a `.env` file inside `server/` (or copy from `.env.example`):
```ini
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vachana_kranti
JWT_SECRET=vachana_kranti_super_secure_jwt_secret_key_2026!
CLIENT_ORIGIN=http://localhost:5173
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=30
```
> **Note:** If your PostgreSQL server runs on port `5433`, update `DATABASE_URL` to `postgres://postgres:postgres@localhost:5433/vachana_kranti`.

#### Step 3.3: Install Dependencies
```bash
npm install
```
*(On Windows PowerShell, if execution policies restrict scripts, use `npm.cmd install`)*

#### Step 3.4: Initialize Schema and Seed Admin User
```bash
npm run db:init
npm run seed
```

#### Step 3.5: Start Backend API
```bash
npm run dev
```
The backend API server will start on: **`http://localhost:4000`**

---

### 4. Frontend Setup & Startup

#### Step 4.1: Open a new terminal and navigate to client
```bash
cd client
```

#### Step 4.2: Configure Frontend Environment
Create a `.env` file inside `client/`:
```ini
VITE_API_URL=/api
```
*(Using `/api` leverages the built-in Vite reverse proxy to prevent CORS issues).*

#### Step 4.3: Install Frontend Dependencies
```bash
npm install
```
*(On Windows PowerShell, use `npm.cmd install`)*

#### Step 4.4: Start Frontend Development Server
```bash
npm run dev
```
Open your browser and navigate to: **`http://localhost:5173`**

---

## 🔐 Demo Admin Credentials

Upon running `npm run seed`, the default administrative user is ready for initial login:

| Field | Value |
| :--- | :--- |
| **Portal URL** | [http://localhost:5173](http://localhost:5173) |
| **Email** | `admin@vachanakranti.local` |
| **Password** | `ChangeMe@123` |
| **Assigned Role** | `admin` (Full permissions across all modules) |

> ⚠️ **Security Notice:** Change this default password immediately after the first login before using the system outside of local development.

---

## 📡 API Reference

All backend endpoints are prefixed with `/api`. Authentication requires the standard `Authorization: Bearer <token>` header.

### Authentication
- `POST /api/auth/login` — Authenticate user and receive JWT bearer token.
- `GET /api/auth/me` — Retrieve currently logged-in user profile & role.

### Dashboard & Analytics
- `GET /api/dashboard` — Retrieve aggregate statistics, counts, and recent metrics.

### Articles
- `GET /api/articles` — Query and filter articles (supports `search`, `status`, `category`).
- `POST /api/articles` — Create a new article.
- `GET /api/articles/:id` — Get single article details.
- `PUT /api/articles/:id` — Update article content, metadata, or status.
- `DELETE /api/articles/:id` — Remove an article.

### E-Paper Editions
- `GET /api/editions` — List all published and draft e-paper editions.
- `POST /api/editions` — Create new edition metadata record.
- `POST /api/editions/:id/pdf` — Upload newspaper edition PDF file (multipart form data).
- `PUT /api/editions/:id` — Update edition details.
- `DELETE /api/editions/:id` — Delete an edition.

### Advertisement Campaigns
- `GET /api/ads` — List campaigns and stats.
- `POST /api/ads` — Create an advertisement campaign.
- `POST /api/ads/:id/event` — Log an ad event (`{"type": "impression" | "click"}`).
- `PUT /api/ads/:id` — Update campaign scheduling or creatives.
- `DELETE /api/ads/:id` — Remove a campaign.

### Leads CRM
- `GET /api/leads` — List prospective advertiser and reader enquiries.
- `POST /api/leads` — Create/record a new lead.
- `PUT /api/leads/:id` — Update lead stage status and notes.

### Reporting & Audit
- `GET /api/reports/leads.csv` — Download leads report in CSV format.
- `GET /api/reports/ads.csv` — Download ad impressions and click reports in CSV.
- `GET /api/audit` — Retrieve immutable audit trail of system events.

### Users (Admin Only)
- `GET /api/users` — List system operators and staff accounts.
- `POST /api/users` — Provision new user with role (`admin`, `editor`, `reporter`, `ad_manager`).
- `PUT /api/users/:id` — Update user details or change role.
- `DELETE /api/users/:id` — Remove user access.

---

## 🏭 Production Deployment Recommendations

1. **Object Storage**: For high-volume production, replace local disk storage (`/uploads`) with Amazon S3, Google Cloud Storage, or Cloudflare R2.
2. **Reverse Proxy & SSL**: Terminate TLS/HTTPS via NGINX, Cloudflare, or AWS ALB.
3. **Database Security**: Enforce SSL connections (`DATABASE_SSL=true`) and automated PostgreSQL WAL archiving.
4. **Secret Management**: Store `JWT_SECRET` and database passwords in a managed secret store (e.g., AWS Secrets Manager, Doppler, or HashiCorp Vault).

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE.txt](LICENSE.txt) file for details.
