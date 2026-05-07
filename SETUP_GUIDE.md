# 🚀 QUICK START GUIDE - ZigZag Hairplace

Follow these steps to get the full system running.

## Step 1: Install PostgreSQL (if not already installed)

### Windows
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer, keep default settings
3. Remember the password you set for `postgres` user zigzagPASS
4. During installation, keep port as `5432`

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Linux
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## Step 2: Create the Database

Open PowerShell or Terminal and run:

```bash
cd c:\Users\User1\Documents\zigzagHairPlace
psql -U postgres -f database.sql
```

When prompted, enter the PostgreSQL password you created.

**What this does:**
- Creates `zigzag_hairplace` database
- Sets up all tables (users, appointments, day_offs)
- Inserts default boss and barber accounts

## Step 3: Configure Backend

1. Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` with your PostgreSQL password:
```
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zigzag_hairplace
JWT_SECRET=your_secure_secret_here_change_in_production
PORT=3000
```

## Step 4: Install Backend Dependencies

```bash
npm install
```

## Step 5: Start the Server

```bash
npm start
```

You should see:
```
✨ ZigZag Hairplace server running on http://localhost:3000
📦 Database: PostgreSQL
```

**Leave this terminal running!**

## Step 6: Open Frontend

After starting the backend, open this in your browser:
```
http://localhost:3000
```

If you want to serve the frontend separately, use a local static server and make sure `API_BASE` in `app.js` points to the backend URL.

## Step 7: Login & Test

### Default Accounts

**Boss Account:**
- Email: `boss@zigzag.com`
- Password: `Boss123!`

**Barber 1:**
- Email: `alex@zigzag.com`
- Password: `Alex2026!`

**Barber 2:**
- Email: `maya@zigzag.com`
- Password: `Maya2026!`

### Test the System

1. **As Client:**
   - Click "Book Now"
   - Select a barber
   - Pick a future date
   - Choose a time slot
   - Enter name and phone
   - Confirm booking

2. **As Boss:**
   - Click "Staff Login"
   - Login with boss@zigzag.com
   - See **Appointments** tab - view full calendar with all bookings
   - See **Day Offs** tab - mark days off for specific barbers or all
   - Check **Barbers** tab - create new barber accounts
   - Try marking a day as recurring (every Monday, etc.)

3. **As Barber:**
   - Login with alex@zigzag.com
   - See only your own appointments
   - Mark your personal day-offs
   - Cannot see Barbers tab

## Key Features Now Working

✅ **Full Calendar Views** - See weeks and days with visual indicators
✅ **Appointments Calendar** - Shows all bookings with client details
✅ **Day-Off Management** - Mark single or recurring day-offs
✅ **Scrollable Dashboard** - Easily navigate between appointments and day-offs
✅ **Tab System** - Switch between different sections seamlessly
✅ **PostgreSQL Database** - Persistent data storage
✅ **Role-Based Access** - Boss, Barber, and Client views

## Fixing Common Issues

### "Cannot connect to database"
```bash
# Check PostgreSQL is running:
psql -U postgres -c "SELECT 1"
# If error, start PostgreSQL service
```

### "API not responding"
- Check server is running (terminal shows port 3000)
- Verify firewall isn't blocking port 3000
- Check browser console for errors (F12)

### "Database not created"
```bash
# Verify database exists:
psql -U postgres -l | grep zigzag_hairplace

# If missing, run setup again:
psql -U postgres -f database.sql
```

### "Cannot book appointments"
- Make sure backend is running (npm start)
- Check browser console (F12) for API errors
- Verify you selected a valid date in the future

## Next Steps

### For Production Deployment:
1. Change `JWT_SECRET` in `.env`
2. Deploy backend to Heroku/Railway/AWS
3. Deploy frontend to Netlify/Vercel
4. Set up PostgreSQL cloud database (AWS RDS / Heroku Postgres)
5. Update API_BASE in app.js to point to deployed backend

### For Customization:
- Update salon name, hours, and pricing in HTML
- Add more barbers in Staff section
- Customize colors in styles.css
- Add payment integration
- Set up email notifications

## Support

If you encounter issues:
1. Check the browser console (F12 → Console tab)
2. Check server terminal for error messages
3. Verify all prerequisites are installed
4. Review README.md for more details

Good luck! 🎉
