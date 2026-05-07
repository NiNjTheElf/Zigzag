# ZigZag Hairplace

A professional salon booking system with PostgreSQL backend and full calendar management for both clients and staff.

## Features

### For Clients
- Browse available barbers
- See appointment availability for chosen dates
- Book appointments with name and phone number
- Real-time slot availability updates

### For Barbers
- Personal calendar view with weekly/monthly appointments
- Mark personal day-offs (including recurring weekly days)
- View all upcoming appointments
- Manage availability

### For Salon Boss
- Full salon calendar overview
- View all appointments across all barbers
- Create new barber accounts
- Manage day-offs for individual barbers or entire salon

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs password hashing

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

## Installation & Setup

### 1. PostgreSQL Database Setup

```bash
# Install PostgreSQL if not already installed
# Windows: https://www.postgresql.org/download/windows/
# macOS: brew install postgresql
# Linux: sudo apt-get install postgresql

# Start PostgreSQL service
# Windows (pgAdmin or Services)
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Connect to PostgreSQL and create database
psql -U postgres

# In psql terminal, run the SQL file:
psql -U postgres -d postgres -f database.sql
```

### 2. Backend Setup

```bash
# Navigate to project directory
cd c:\Users\User1\Documents\zigzagHairPlace

# Install dependencies
npm install

# Create .env file with your database credentials
# Copy from .env.example and update values:
cp .env.example .env

# Edit .env file
# DB_USER=postgres
# DB_PASSWORD=your_postgres_password
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=zigzag_hairplace
# JWT_SECRET=change_this_to_a_secure_random_string
# PORT=3000

# Start the server
npm start
# Server runs on http://localhost:3000
```

### 3. Frontend Setup

The frontend is served by the backend. After running the server, open:
```bash
http://localhost:3000
```

If you want to serve the frontend separately, use any static server and make sure `API_BASE` in `app.js` points to the backend URL.

## Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Boss | boss@zigzag.com | Boss123! |
| Barber | alex@zigzag.com | Alex2026! |
| Barber | maya@zigzag.com | Maya2026! |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email and password

### Barbers
- `GET /api/barbers` - List all barbers
- `POST /api/barbers` - Create new barber (boss only)

### Appointments
- `GET /api/appointments/month/:year/:month` - Get monthly appointments
- `GET /api/appointments/available?barberId=X&date=YYYY-MM-DD` - Check available slots
- `POST /api/appointments` - Book appointment

### Day-Offs
- `GET /api/dayoffs?year=YYYY&month=MM` - Get day-offs for a month
- `POST /api/dayoffs` - Create day-off (supports recurring)
- `PUT /api/dayoffs/:id` - Update day-off
- `DELETE /api/dayoffs/:id` - Delete day-off

## Database Schema

### Users Table
- `id` (serial primary key)
- `name` (varchar)
- `email` (varchar unique)
- `password` (varchar hashed)
- `role` (boss | barber)
- `created_at` (timestamp)

### Appointments Table
- `id` (serial primary key)
- `barber_id` (foreign key)
- `client_name` (varchar)
- `client_phone` (varchar)
- `appointment_date` (date)
- `appointment_time` (varchar)

### Day-Offs Table
- `id` (serial primary key)
- `barber_id` (foreign key)
- `day_off_date` (date)
- `is_recurring` (boolean)
- `recurring_day_of_week` (0-6)
- `notes` (varchar)

## Deployment

### For Production
1. Change `JWT_SECRET` to a strong random string
2. Update database credentials in `.env`
3. Set `NODE_ENV=production`
4. Use a process manager like PM2
5. Configure HTTPS/SSL
6. Set up proper CORS origins

### Hosting Options
- **Backend**: Heroku, Railway, Fly.io, AWS, Digital Ocean
- **Frontend**: Netlify, Vercel, AWS S3 + CloudFront
- **Database**: AWS RDS, Heroku Postgres, Azure Database for PostgreSQL

## File Structure

```
zigzagHairPlace/
├── index.html          # Main HTML file
├── styles.css          # Global styles
├── app.js              # Frontend JavaScript
├── server.js           # Express backend
├── database.sql        # PostgreSQL schema
├── package.json        # Node dependencies
├── .env.example        # Environment variables template
└── README.md           # This file
```

## Troubleshooting

### Database Connection Failed
- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check `.env` credentials match your PostgreSQL setup
- Ensure database exists: `psql -U postgres -l | grep zigzag_hairplace`

### Cannot reach server from frontend
- Verify backend is running: `curl http://localhost:3000/api/barbers`
- Check CORS headers in server.js
- Ensure backend port matches API_BASE in app.js

### Appointments not showing
- Check browser console for API errors
- Verify you're logged in with a valid token
- Check that appointments data exists in database

## Security Notes

- Passwords are hashed with bcryptjs (10 salt rounds)
- JWT tokens expire after 7 days
- Always use HTTPS in production
- Never commit `.env` file with real credentials
- Validate all inputs on backend

## License

Proprietary - ZigZag Hairplace

## Support

For issues or questions, contact the development team.

