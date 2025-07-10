# Ibex Backend API

Educational Management System Backend API built with Express.js and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase project

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env` file with:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CLIENT_URL=https://your-frontend.vercel.app
```

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create new class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Assignments
- `GET /api/assignments` - Get all assignments
- `POST /api/assignments` - Create new assignment
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id` - Get file
- `DELETE /api/files/:id` - Delete file

## 🔧 Deployment

This backend is configured for deployment on Render.

### Render Deployment
1. Connect this repository to Render
2. Set environment variables in Render dashboard
3. Deploy as Web Service

## 📝 License

MIT License 