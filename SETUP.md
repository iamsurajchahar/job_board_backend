# Job Board API - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd my-job-board-api
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/job_board_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"

# Payment Gateway (Razorpay) - Optional for development
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-secret"

# Environment
NODE_ENV="development"
PORT=4000
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data (roles, plans, admin user)
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

The API will be available at `http://localhost:4000`

### 5. Test the API
```bash
npm run test:api
```

## 📋 Features Implemented

### ✅ User Roles
- **User**: Job seekers who can apply to jobs and bookmark them
- **Company**: Job posters who can create and manage job listings  
- **Admin**: System administrators with full access

### ✅ Authentication
- JWT-based role-based access control
- Secure password hashing with bcrypt
- Token-based authentication for all protected routes

### ✅ Job Management
- Companies can post jobs (FULL_TIME, INTERNSHIP)
- Public job listings with search and filtering
- Job CRUD operations for companies
- Soft delete functionality

### ✅ Job Applications
- Users can apply to jobs within their plan limits
- Application status tracking (PENDING, REVIEWING, SHORTLISTED, etc.)
- Companies can view and update application status
- Users can withdraw applications

### ✅ Bookmarking System
- Users can bookmark jobs for later
- Check if job is bookmarked
- View and manage bookmarks

### ✅ Subscription System
- Freemium model with plan limits
- Free Plan: 5 applications, 1 job + 2 internships
- Premium Plan: Unlimited applications and job postings
- Plan upgrade/downgrade functionality

### ✅ Payment Integration
- Razorpay integration for subscription payments
- Mock payment system for development
- Payment verification and history tracking

### ✅ Admin Panel
- Dashboard with system statistics
- User and company management
- Ban/unban functionality
- Job moderation

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register/user` - Register user
- `POST /api/auth/register/company` - Register company
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user profile

### Jobs
- `GET /api/jobs` - Get all jobs (public)
- `POST /api/jobs` - Create job (company only)
- `GET /api/jobs/:id` - Get job by ID (public)
- `PUT /api/jobs/:id` - Update job (company owner)
- `DELETE /api/jobs/:id` - Delete job (company owner)
- `GET /api/jobs/company/my-jobs` - Get company's jobs

### Applications
- `POST /api/applications` - Apply to job (user only)
- `GET /api/applications/my-applications` - Get user's applications
- `GET /api/applications/:id` - Get application by ID
- `PATCH /api/applications/:id/status` - Update application status (company)
- `DELETE /api/applications/:id` - Withdraw application (user)
- `GET /api/applications/job/:jobId` - Get applications for job (company)

### Bookmarks
- `POST /api/bookmarks` - Add bookmark (user only)
- `GET /api/bookmarks` - Get user's bookmarks
- `DELETE /api/bookmarks/:jobId` - Remove bookmark
- `GET /api/bookmarks/check/:jobId` - Check if bookmarked

### Subscriptions
- `GET /api/subscriptions/plans` - Get available plans
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions` - Create/upgrade subscription
- `DELETE /api/subscriptions` - Cancel subscription
- `GET /api/subscriptions/usage` - Get usage statistics

### Payments
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `GET /api/payments/history` - Get payment history

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/companies` - Get all companies
- `GET /api/admin/jobs` - Get all jobs
- `PATCH /api/admin/users/:id/ban` - Ban/unban user
- `PATCH /api/admin/companies/:id/ban` - Ban/unban company
- `DELETE /api/admin/jobs/:id` - Remove job

## 🧪 Testing

### Default Admin Account
After running the seed script:
- Email: `admin@jobboard.com`
- Password: `admin123`

### Postman Collection
Import the provided `Job_Board_API.postman_collection.json` for comprehensive API testing.

### Automated Tests
Run the test script to verify all endpoints:
```bash
npm run test:api
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=your-production-db-url
JWT_SECRET=your-production-jwt-secret
RAZORPAY_KEY_ID=your-production-razorpay-key
RAZORPAY_KEY_SECRET=your-production-razorpay-secret
```

## 🔒 Security Features

- JWT token-based authentication
- Role-based access control
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Secure headers middleware
- Rate limiting (can be added)
- SQL injection protection via Prisma

## 📊 Database Schema

The application uses PostgreSQL with the following key models:
- Users, Companies, Admins
- Jobs, Applications, Bookmarks
- Subscriptions, Plans, Payments
- Roles and permissions

## 🛠 Tech Stack

- **Backend**: Hono (TypeScript)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Payment**: Razorpay
- **Password Hashing**: bcrypt
- **Validation**: Built-in validation

## 📝 Notes

- The API runs on port 4000 by default
- Mock payments work in development mode
- All timestamps are in UTC
- Soft deletes are used for jobs
- Comprehensive error handling implemented
- Pagination supported on list endpoints 