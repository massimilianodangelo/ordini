# Installation & Setup Guide

Complete guide to install and deploy GroupOrder Hub on your infrastructure.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Database Configuration](#database-configuration)
4. [Environment Variables](#environment-variables)
5. [Running the Application](#running-the-application)
6. [Production Deployment](#production-deployment)
7. [Platform-Specific Guides](#platform-specific-guides)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js 18+** ([Download](https://nodejs.org/))
- **PostgreSQL 14+** (or cloud database like Neon, Supabase)
- **npm** (comes with Node.js)

### Recommended Tools
- **Git** for version control
- **VS Code** or similar code editor
- **Postman/Insomnia** for API testing (optional)

---

## Local Development Setup

### 1. Extract and Navigate
```bash
unzip grouporder-hub.zip
cd grouporder-hub
```

### 2. Install Dependencies
```bash
npm install
```

This installs all frontend and backend dependencies (~200 packages).

**Expected output:**
```
added 789 packages in 45s
```

### 3. Verify Installation
```bash
npm list --depth=0
```

Should show core packages: `react`, `express`, `drizzle-orm`, `typescript`, etc.

---

## Database Configuration

### Option 1: Local PostgreSQL

**Install PostgreSQL:**
- **macOS**: `brew install postgresql@14`
- **Ubuntu**: `sudo apt-get install postgresql-14`
- **Windows**: [Download installer](https://www.postgresql.org/download/windows/)

**Create Database:**
```bash
psql -U postgres
CREATE DATABASE grouporder;
CREATE USER grouporder_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE grouporder TO grouporder_user;
\q
```

**Connection String:**
```
DATABASE_URL=postgresql://grouporder_user:secure_password_here@localhost:5432/grouporder
```

### Option 2: Cloud Database (Recommended for Production)

#### Neon (Free tier available)
1. Sign up at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string (format: `postgresql://user:pass@host/dbname`)

#### Supabase (Free tier available)
1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy URI format

#### Railway (Free tier available)
1. Sign up at [railway.app](https://railway.app)
2. New Project → Add PostgreSQL
3. Copy `DATABASE_URL` from variables

---

## Environment Variables

### 1. Create `.env` File
Copy the example file:
```bash
cp .env.example .env
```

### 2. Configure Variables
Edit `.env` with your values:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/grouporder

# Session Secret (Generate a random string)
SESSION_SECRET=your-super-secure-random-string-min-32-chars

# Environment
NODE_ENV=development

# Optional: Port (default is 5000)
# PORT=5000
```

### Generating SESSION_SECRET
**Option 1 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2 - OpenSSL:**
```bash
openssl rand -hex 32
```

**Option 3 - Online:** [RandomKeygen](https://randomkeygen.com/)

---

## Database Schema Setup

### Push Schema to Database
```bash
npm run db:push
```

**Expected output:**
```
✓ Schema pushed to database successfully
```

**If you get data loss warning:**
```bash
npm run db:push -- --force
```

### Verify Tables Created
```bash
psql $DATABASE_URL -c "\dt"
```

Should show tables: `users`, `products`, `orders`, `order_items`, `sessions`

---

## Running the Application

### Development Mode (Hot Reload)
```bash
npm run dev
```

**Expected output:**
```
Server in ascolto sulla porta 5000
Vite server started at http://localhost:5173
```

**Access the app:**
- Frontend: `http://localhost:5000`
- Backend API: `http://localhost:5000/api/health`

### Production Mode
```bash
npm run build
npm start
```

**Expected output:**
```
Server in ascolto sulla porta 5000
```

---

## Default Admin Account

On first run, the system creates a default admin:

- **Email**: `admin@grouporder.com`
- **Password**: `admin123`

⚠️ **CRITICAL**: Change this password immediately after first login!

**To change admin password:**
1. Login with default credentials
2. Go to Account settings
3. Update password

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] Set `NODE_ENV=production` in environment
- [ ] Use strong `SESSION_SECRET` (min 32 random characters)
- [ ] Change default admin password
- [ ] Configure production database (not localhost)
- [ ] Set up SSL/HTTPS (required for secure cookies)
- [ ] Configure CORS if needed (see `server/index.ts`)

### Build Process
```bash
npm install --production=false
npm run build
```

Creates optimized production build in `dist/` directory.

### Environment Variables (Production)
```env
DATABASE_URL=postgresql://user:pass@production-host/dbname
SESSION_SECRET=production-secret-min-32-chars
NODE_ENV=production
PORT=5000
```

---

## Platform-Specific Guides

### Railway

1. **Create New Project**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub

2. **Add PostgreSQL**
   - Add service → PostgreSQL
   - Database auto-configured

3. **Environment Variables**
   - Add `SESSION_SECRET` manually
   - `DATABASE_URL` auto-set by Railway

4. **Deploy Settings**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Port**: Railway auto-assigns (app uses `process.env.PORT`)

5. **Custom Domain** (Optional)
   - Settings → Domains → Add custom domain

### Render

1. **Create Web Service**
   - Dashboard → New → Web Service
   - Connect GitHub repo

2. **Add PostgreSQL**
   - Dashboard → New → PostgreSQL
   - Copy internal connection string

3. **Environment Variables**
   ```
   DATABASE_URL=<from PostgreSQL service>
   SESSION_SECRET=<generate random string>
   NODE_ENV=production
   ```

4. **Build Settings**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

5. **Health Check**
   - Path: `/api/health`

### Vercel (with External Database)

⚠️ **Note**: Vercel is serverless, requires external database (Neon/Supabase)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Add Environment Variables**
   - Project Settings → Environment Variables
   - Add `DATABASE_URL`, `SESSION_SECRET`

4. **Configure Build**
   - Vercel auto-detects Vite projects
   - Server runs as serverless function

### VPS (DigitalOcean, Linode, AWS EC2)

1. **Connect to Server**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Node.js & PostgreSQL**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql
   ```

3. **Clone Project**
   ```bash
   git clone <your-repo>
   cd grouporder-hub
   npm install
   ```

4. **Configure Database**
   ```bash
   sudo -u postgres createdb grouporder
   sudo -u postgres createuser grouporder_user -P
   ```

5. **Set Environment Variables**
   ```bash
   nano .env
   # Add DATABASE_URL, SESSION_SECRET, NODE_ENV=production
   ```

6. **Build & Start**
   ```bash
   npm run build
   npm start
   ```

7. **Use PM2 for Process Management**
   ```bash
   npm install -g pm2
   pm2 start npm --name "grouporder" -- start
   pm2 startup
   pm2 save
   ```

8. **Set Up Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. **SSL with Certbot**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Troubleshooting

### Database Connection Fails
**Error**: `ECONNREFUSED` or `password authentication failed`

**Solutions:**
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`
2. Check PostgreSQL is running: `pg_isready`
3. Test connection: `psql $DATABASE_URL`
4. Check firewall allows port 5432

### Port Already in Use
**Error**: `EADDRINUSE: address already in use :::5000`

**Solutions:**
1. Change port in `.env`: `PORT=3000`
2. Kill process using port: `lsof -ti:5000 | xargs kill -9`

### Build Fails
**Error**: `Cannot find module` or `Type error`

**Solutions:**
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Check Node.js version: `node --version` (must be 18+)

### Session Not Persisting
**Error**: Users logged out immediately

**Solutions:**
1. Check `SESSION_SECRET` is set
2. Verify cookies enabled in browser
3. Ensure HTTPS in production (required for secure cookies)
4. Check `sameSite` cookie settings in `server/index.ts`

### Database Schema Mismatch
**Error**: Column does not exist

**Solutions:**
1. Re-push schema: `npm run db:push -- --force`
2. Check schema file: `shared/schema.ts`
3. Verify migrations applied: `SELECT * FROM drizzle_migrations;`

---

## Customization After Install

### Change Branding
1. **App Name**: Edit `client/index.html` (title tag)
2. **Colors**: Edit `client/src/index.css` (CSS variables)
3. **Logo**: Replace favicon in `client/index.html`

### Modify Product Categories
1. Open `shared/schema.ts`
2. Update `categoryEnum` values
3. Run `npm run db:push -- --force`

### Add Custom Fields
1. Edit schema in `shared/schema.ts`
2. Update insert/select types
3. Push schema changes
4. Update forms in `client/src/pages/`

---

## Support

### Resources
- **Documentation**: See README.md for features overview
- **Code Comments**: All files have inline explanations
- **Issue Tracking**: Check GitHub issues (if repository shared)

### Common Questions

**Q: Can I use MySQL instead of PostgreSQL?**  
A: Possible but requires Drizzle adapter changes. PostgreSQL recommended.

**Q: How do I add email notifications?**  
A: Integrate SendGrid/Mailgun in `server/routes.ts` after order creation.

**Q: Can I white-label this?**  
A: Yes! Change branding in `client/index.html` and `client/src/index.css`.

**Q: How to add more admin users?**  
A: Login as admin → User Management → Create user → Assign admin role.

---

**Setup complete! You're ready to launch GroupOrder Hub.**
