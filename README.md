# Hello Team Workforce Hub

A centralized operational platform to manage remote workforce activity, client approvals, payroll preparation, monitoring integrations, and employee engagement.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js + Vite + Tailwind CSS |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | JWT (JSON Web Tokens) |

## Project Structure

```
helloteam/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # React context (Auth, etc.)
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── hooks/      # Custom React hooks
│   └── package.json
│
├── backend/            # Node.js backend API
│   ├── src/
│   │   ├── config/     # Configuration files
│   │   ├── controllers/# Route handlers
│   │   ├── middleware/ # Express middleware
│   │   ├── routes/     # API routes
│   │   ├── types/      # TypeScript types
│   │   └── utils/      # Utility functions
│   ├── prisma/         # Database schema & migrations
│   └── package.json
│
└── deliverables/       # Project documentation
    └── Phase1_Sprint_Plan.md
```

## Prerequisites

- **Node.js** v18+
- **PostgreSQL** v14+
- **npm** or **yarn**

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd helloteam
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE helloteam_db;"

# Or using createdb
createdb -U postgres helloteam_db
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Update .env with your database credentials if different:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helloteam_db?schema=public"

# Run database migrations
npx prisma migrate dev

# Seed demo data
npx ts-node prisma/seed.ts

# Start development server
npm run dev
```

The backend will start at **http://localhost:3000**

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at **http://localhost:5173**

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | demo123456 |
| Client | client@demo.com | demo123456 |
| Admin | admin@demo.com | demo123456 |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/profile` | Get user profile |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/validate-session` | Validate session |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |

## Environment Variables

### Backend (.env)

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helloteam_db?schema=public"

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Session Configuration
SESSION_TIMEOUT_MINUTES=30

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000/api
```

## Available Scripts

### Backend

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run database migrations
npm run prisma:studio     # Open Prisma Studio (database GUI)
npm run prisma:seed       # Seed demo data
```

### Frontend

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Portal Types

### 1. Employee Portal (`/employee/*`)
- Dashboard with work status
- Clock In/Out functionality
- Schedule viewing
- Leave requests
- Support tickets
- Profile management

### 2. Client Portal (`/client/*`)
- Workforce overview
- Time records approval
- Employee management
- Billing information
- Analytics

### 3. Admin Portal (`/admin/*`)
- Operations dashboard
- Employee management
- Client management
- Time records
- Approvals
- Payroll
- Settings

## Project Phases

### Phase 1 - Core Workforce Operations & Visibility (Current)
- Authentication & Security
- Employee work sessions (Clock In/Out)
- Schedule visibility
- Client dashboard
- Admin operations dashboard

### Phase 2 - Approvals, Requests & Payroll Readiness
- Time approval workflows
- Leave request management
- Payroll validation

### Phase 3 - Billing, Monitoring & Governance
- Teramind integration
- Billing & invoicing
- QuickBooks integration
- Audit logs

## Development Notes

### Adding New API Routes

1. Create controller in `backend/src/controllers/`
2. Create route in `backend/src/routes/`
3. Register route in `backend/src/routes/index.ts`

### Adding New Pages

1. Create page component in `frontend/src/pages/<portal>/`
2. Export from `frontend/src/pages/<portal>/index.js`
3. Add route in `frontend/src/App.jsx`

### Database Changes

1. Update schema in `backend/prisma/schema.prisma`
2. Run migration: `npx prisma migrate dev --name <migration-name>`
3. Update seed if needed: `backend/prisma/seed.ts`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -U postgres -c "\l" | grep helloteam_db
```

### Prisma Issues

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## License

ISC

## Contact

For support or questions, contact the Hello Team development team.
