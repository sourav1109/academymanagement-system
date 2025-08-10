# School Management System

A comprehensive school management system built with Node.js, Express, and MongoDB.

## Project Structure

```
school-management-system/
├── app.js                  # Main application file
├── models/                 # Database models
│   ├── User.js             # User model (students, staff, admin)
│   ├── Class.js            # Class model
│   ├── Timetable.js        # Timetable model
│   ├── Attendance.js       # Attendance model
│   ├── Announcement.js     # Announcement model
│   ├── Tournament.js       # Tournament model
│   ├── Enrollment.js       # Enrollment model
│   ├── RectificationRequest.js # Attendance rectification requests
│   ├── HealthReport.js     # Student health reports
│   ├── PerformanceReport.js # Student performance reports
│   └── News.js             # School news and events
├── routes/                 # API routes
│   ├── timetable.js        # Timetable management routes
│   └── performance.js      # Performance report routes
├── views/                  # EJS templates
│   ├── admin/              # Admin views
│   │   ├── timetable.ejs   # Timetable management
│   │   ├── dashboard.ejs   # Admin dashboard
│   │   └── ...             # Other admin views
│   ├── staff/              # Staff views
│   │   ├── dashboard.ejs   # Staff dashboard
│   │   └── ...             # Other staff views
│   ├── students/           # Student views
│   │   ├── dashboard.ejs   # Student dashboard
│   │   └── ...             # Other student views
│   └── partials/           # Reusable view components
│       ├── header.ejs      # Common header
│       └── footer.ejs      # Common footer
├── public/                 # Static assets
│   ├── css/                # Stylesheets
│   ├── js/                 # Client-side JavaScript
│   └── images/             # Images
├── middleware/             # Custom middleware
├── utils/                  # Utility functions
└── uploads/                # File uploads directory
```

## Key Features

1. **User Management**
   - Multi-role authentication (admin, staff, student)
   - Session-based authentication
   - User profiles with images

2. **Timetable Management**
   - Create and manage class timetables
   - Assign teachers to periods
   - View timetables by class and academic year

3. **Attendance System**
   - Mark attendance for students and staff
   - Attendance rectification requests
   - Attendance reports

4. **Performance Tracking**
   - Health reports for students
   - Performance reports for students
   - Academic progress tracking

5. **Communication**
   - Announcements
   - News and events
   - Tournament management

## Authentication System

The system uses session-based authentication with the following roles:
- **Admin**: Full access to all features
- **Staff**: Access to teaching-related features
- **Student**: Access to student-specific features

## Database Models

### User Model
- Stores information about all users (students, staff, admin)
- Includes fields for name, email, password, role, UID, etc.

### Class Model
- Represents school classes
- Includes fields for name, section, academic year, class teacher, etc.

### Timetable Model
- Stores timetable information for each class
- Includes periods with subject, teacher, and time information

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Set up MongoDB connection in app.js

3. Start the server:
   ```
   npm start
   ```

4. Access the application at http://localhost:3000

## Default Admin Account

- Email: admin@school.com
- Password: admin123
- UID: A0001 