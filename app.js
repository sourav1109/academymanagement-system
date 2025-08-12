import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import multer from 'multer';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup require to load CommonJS modules
const require = createRequire(import.meta.url);

// Import CommonJS modules (models & routes)
const User = require('./models/User.js');
const Announcement = require('./models/announcement.js');
const Tournament = require('./models/tournament.js');
const Attendance = require('./models/attendence.js');
const RectificationRequest = require('./models/RectificationRequest.js');
const PerformanceReport = require('./models/PerformenceReport.js');
const News = require('./models/news.js');
const Timetable = require('./models/Timetable.js');
const Class = require('./models/class.js');
const StaffAssignment = require('./models/StaffAssignment.js');

const staffAssignmentRoutes = require('./routes/staffAssignment.js');

// Setup multer for file uploads
const upload = multer({ dest: 'public/images/' });

const app = express();
app.use('/public', express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    createAdminIfNotExists();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });

// Your middleware and routes setup here...
// For example:

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ 
  secret: process.env.SESSION_SECRET || 'dev_secret', 
  resave: false, 
  saveUninitialized: true 
}));
app.use(express.json()); 
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Define your createAdminIfNotExists and routes below



// Function to create admin user if not exists
async function createAdminIfNotExists() {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const admin = new User({
            name: 'Admin',
            email: adminEmail,
            role: 'admin',
            password: hashedPassword,
            uid: 'A0001',
            image: '/images/default.jpg', // Default image path
            mobileNumber: '1234567890', // Default mobile number
            sex: 'male', // Default sex value
            age: 42, // Default age value
            active: true // Admin is always active
        });

        await admin.save();
        console.log('Admin user created successfully');

        const mailOptions = {
            from: adminEmail,
            to: adminEmail,
            subject: 'Admin Account Created',
            text: `Admin account has been created. Your UID is: A0001 and password is: ${adminPassword}`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                return console.error('Error sending email:', error);
            }
            console.log('Admin credentials sent via email');
        });
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

// Routes
app.get('/', async (req, res) => {
    const tournaments = await Tournament.find();
    res.render('index', { tournaments });
});

app.get('/signup', (req, res) => {
    // Check if user is authenticated and is an admin
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    res.render('signup');
});

app.post('/signup', upload.single('image'), async (req, res) => {
    // Check if user is authenticated and is an admin
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    
    try {
        const { 
            name, age, role, sex, email, mobileNumber, password, confirmPassword,
            parentName, parentMobile, class: studentClass, section, rollNumber, 
            admissionNumber, address, subject 
        } = req.body;
        const image = req.file;

        // Basic validation for all users
        if (!name || !age || !role || !sex || !email || !mobileNumber || !password || !confirmPassword || !image) {
            return res.send('All fields are required.');
        }

        // Additional validation for students
        if (role === 'student') {
            if (!parentName || !parentMobile || !studentClass || !section || !rollNumber || !admissionNumber || !address) {
                return res.send('All student-specific fields are required.');
            }
            
            // Validate class range
            if (studentClass < 1 || studentClass > 12) {
                return res.send('Class must be between 1 and 12.');
            }
            
            // Validate section
            if (!['A', 'B', 'C', 'D', 'E'].includes(section.toUpperCase())) {
                return res.send('Invalid section. Must be A, B, C, D, or E.');
            }
        }

        // Additional validation for staff
        if (role === 'staff') {
            if (!subject) {
                return res.send('Subject is required for staff members.');
            }
            
            // Validate subject
            const validSubjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Computer Science', 'Physical Education', 'Art', 'Music', 'Languages'];
            if (!validSubjects.includes(subject)) {
                return res.send('Invalid subject. Please select a valid subject.');
            }
        }

        if (password !== confirmPassword) {
            return res.send('Passwords do not match.');
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.send('Email is already registered.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate UID
        let uid;
        if (role === 'student') {
            uid = 'S' + Math.floor(10000 + Math.random() * 90000);
        } else if (role === 'staff') {
            uid = 'T' + Math.floor(100 + Math.random() * 900);
        }

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiry = Date.now() + 3600000; // 1 hour expiry

        // Save user data temporarily in session
        req.session.signupData = {
            name,
            age,
            role,
            sex,
            email,
            mobileNumber,
            password: hashedPassword,
            uid,
            image: `/images/${image.filename}`,
            otp,
            otpExpiry,
            // Add student-specific fields
            parentName,
            parentMobile,
            class: studentClass,
            section: section ? section.toUpperCase() : undefined,
            rollNumber,
            admissionNumber,
            address,
            // Add staff-specific fields
            subject
        };

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Signup OTP',
            text: `Your OTP for signup is: ${otp}`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error(error);
                return res.render('signup', { message: 'Invalid email. Please try again.' });
            }
            res.render('verifySignupOtp', { message: 'OTP sent successfully. Please check your email.', email });
        });
    } catch (error) {
        console.error(error);
        res.send('An error occurred during signup.');
    }
});

app.post('/verify-signup-otp', async (req, res) => {
    // Check if user is authenticated and is an admin
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    
    const { email, otp } = req.body;
    const signupData = req.session.signupData;

    if (signupData && signupData.email === email) {
        if (signupData.otp === otp && signupData.otpExpiry > Date.now()) {
            const newUser = new User({
                name: signupData.name,
                age: signupData.age,
                role: signupData.role,
                sex: signupData.sex,
                email: signupData.email,
                mobileNumber: signupData.mobileNumber,
                password: signupData.password,
                uid: signupData.uid,
                image: signupData.image,
                active: true,
                // Add student-specific fields
                ...(signupData.role === 'student' && {
                    parentName: signupData.parentName,
                    parentMobile: signupData.parentMobile,
                    class: signupData.class,
                    section: signupData.section,
                    rollNumber: signupData.rollNumber,
                    admissionNumber: signupData.admissionNumber,
                    address: signupData.address
                }),
                // Add staff-specific fields
                ...(signupData.role === 'staff' && {
                    subject: signupData.subject
                })
            });

            await newUser.save();
            req.session.signupData = null;

            const mailOptions = {
                from: 'your-email@gmail.com',
                to: newUser.email,
                subject: 'Your Student ID',
                text: `Your signup was successful! Your Student ID is: ${newUser.uid}. Please keep it safe.`,
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent successfully:', info.response);
                }
            });
            
            res.send(`Signup successful! Your UID is: ${signupData.uid}`);
        } else {
            res.send('Invalid or expired OTP.');
        }
    } else {
        res.send('Session expired. Please try signing up again.');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { uid, password } = req.body; // Get UID and password from the request
    const user = await User.findOne({ uid }); // Fetch user by UID

    if (user && await user.comparePassword(password)) { // Use the model's comparePassword method
        if (!user.active) {
            return res.send('Your account is inactive. Please contact the admin.');
        }

        // Successful login
        req.session.userId = user._id;
        req.session.role = user.role;

        if (user.role === 'student') {
            res.redirect('/students/dashboard'); // Redirect to student dashboard
        } else if (user.role === 'staff') {
            res.redirect('/staff/dashboard'); // Redirect to staff dashboard
        } else if (user.role === 'admin') {
            res.redirect('/admins/dashboard'); // Redirect to admin dashboard
        }
    } else {
        res.send('Invalid UID or Password');
    }
});


app.get('/forgot-password', (req, res) => {
    res.render('forgotPassword');
});

app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save OTP to user
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP via email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: `
                <h1>Password Reset OTP</h1>
                <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

app.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!email || !otp || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Find user and verify OTP
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Update password
        user.password = newPassword;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        // Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Successful',
            html: `
                <h1>Password Reset Successful</h1>
                <p>Your password has been successfully reset.</p>
                <p>If you didn't make this change, please contact support immediately.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error in verify OTP:', error);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
});

app.get('/students/dashboard', async (req, res) => {
    if (req.session.role === 'student') {
        const user = await User.findById(req.session.userId);
        const tournaments = await Tournament.find({ 'enrollmentRequests.status': 'approved' });

        const enrolledTournaments = tournaments.filter(tournament => {
            return tournament.enrollmentRequests.some(request => request.email === user.email);
        });

        // const progressReports = await ProgressReport.find({ studentId: user._id });

        res.render('students/dashboard', { user, tournaments, enrolledTournaments });
    } else {
        res.send('Unauthorized');
    }
});





app.get('/staff/dashboard', async (req, res) => {
    if (req.session.role === 'staff') {
        const user = await User.findById(req.session.userId);
        const announcements = await Announcement.find();
        const message = req.session.message;
        delete req.session.message;
        res.render('staff/dashboard', { user, announcements, message });
    } else {
        res.send('Unauthorized');
    }
});

app.get('/admins/manage-users', async (req, res) => {
    if (req.session.role === 'admin') {
        const users = await User.find();
        const success = req.query.success || null;
        const user = await User.findById(req.session.userId);
        res.render('admins/manageUsers', { users, success, user });
    } else {
        res.send('Unauthorized');
    }
});

// Toggle user active status
app.post('/admins/users/:id/toggle', async (req, res) => {
    if (req.session.role === 'admin') {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (user) {
            user.active = !user.active;
            await user.save();
            res.redirect('/admins/manage-users');
        } else {
            res.send('User not found.');
        }
    } else {
        res.send('Unauthorized');
    }
});

app.get('/admins/dashboard', async (req, res) => {
    if (req.session.role === 'admin') {
        const user = await User.findById(req.session.userId);
        const announcements = await Announcement.find();
        res.render('admins/dashboard', { user, announcements });
    } else {
        res.send('Unauthorized');
    }
});


app.get('/admins/announcements', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const announcements = await Announcement.find().populate('createdBy').exec();
            res.render('admins/announcements', { announcements });
        } catch (error) {
            res.status(500).send('Error fetching announcements: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});


app.post('/admins/announcements/:id/delete', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const announcementId = req.params.id;
            await Announcement.findByIdAndDelete(announcementId);
            res.redirect('/admins/announcements');
        } catch (error) {
            res.status(500).send('Error deleting announcement: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/admins/announcements', async (req, res) => {
    if (req.session.role === 'admin') {
        const { title, content } = req.body;
        try {
            const newAnnouncement = new Announcement({ title, content, date: new Date() });
            await newAnnouncement.save();
            res.status(201).json(newAnnouncement); // Return the new announcement
        } catch (error) {
            res.status(500).send('Error creating announcement');
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});


// Tournament routes
app.get('/admins/tournaments', async (req, res) => {
    if (req.session.role === 'admin') {
        const tournaments = await Tournament.find();
        res.render('admins/tournaments', { tournaments });
    } else {
        res.send('Unauthorized');
    }
});

app.post('/admins/tournaments', async (req, res) => {
    if (req.session.role === 'admin') {
        const { name, date, description } = req.body;
        const newTournament = new Tournament({ name, date, description });

        await newTournament.save();
        res.send('Tournament created successfully.');
    } else {
        res.send('Unauthorized');
    }
});


// Display enrolled students in admin dashboard
app.get('/admins/tournaments/:id/enrollments', async (req, res) => {
    if (req.session.role === 'admin') {
        const tournamentId = req.params.id;
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.send('Tournament not found.');
        }

        res.render('admins/enrollments', { tournament });
    } else {
        res.send('Unauthorized');
    }
});

// Approve enrollments and send email
app.post('/admins/tournaments/:tournamentId/enrollments/:enrollmentId/update', async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized', alertType: 'error' });
        }

        const { tournamentId, enrollmentId } = req.params;
        const { action, reason } = req.body;

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found', alertType: 'error' });
        }

        const enrollment = tournament.enrollmentRequests.id(enrollmentId);
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found', alertType: 'error' });
        }

        if (action === 'approve') {
            enrollment.status = 'approved';
            enrollment.declineReason = '';
        } else if (action === 'decline') {
            enrollment.status = 'declined';
            enrollment.declineReason = reason || 'No reason provided';
        } else {
            return res.status(400).json({ message: 'Invalid action', alertType: 'error' });
        }

        await tournament.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: enrollment.email,
            subject: action === 'approve' ? 'Enrollment Approved' : 'Enrollment Declined',
            text: action === 'approve'
                ? `Your enrollment for the tournament "${tournament.name}" has been approved.`
                : `Your enrollment for the tournament "${tournament.name}" has been declined. Reason: ${enrollment.declineReason}.`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error('Email error:', error);
                return res.status(500).json({ message: 'Failed to send email', alertType: 'error' });
            }

            res.status(200).json({
                message: `Enrollment ${action === 'approve' ? 'approved' : 'declined'} successfully.`,
                alertType: 'success'
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', alertType: 'error' });
    }
});

// Update Remarks
app.post('/admins/tournaments/:tournamentId/enrollments/:enrollmentId/remarks', async (req, res) => {
    const { tournamentId, enrollmentId } = req.params;
    const { remarks } = req.body;

    try {
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found', alertType: 'error' });
        }

        const enrollment = tournament.enrollmentRequests.id(enrollmentId);
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found', alertType: 'error' });
        }

        enrollment.remarks = remarks;
        await tournament.save();
        res.json({ message: 'Remarks updated successfully.', alertType: 'success' });
    } catch (error) {
        console.error('Error updating remarks:', error);
        res.status(500).json({ message: 'Error updating remarks', alertType: 'error' });
    }
});

// Delete Enrollment
app.post('/admins/tournaments/:tournamentId/enrollments/:enrollmentId/delete', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const { tournamentId, enrollmentId } = req.params;
            const tournament = await Tournament.findByIdAndUpdate(
                tournamentId,
                { $pull: { enrollmentRequests: { _id: enrollmentId } } },
                { new: true }
            );
            if (!tournament) {
                return res.status(404).json({ message: 'Tournament not found.', alertType: 'error' });
            }
            res.json({ message: 'Enrollment deleted successfully.', alertType: 'success' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting enrollment: ' + error.message, alertType: 'error' });
        }
    } else {
        res.status(403).json({ message: 'Unauthorized', alertType: 'error' });
    }
});

// Route to handle the deletion of a tournament
app.post('/admins/tournaments/:id/delete', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const tournamentId = req.params.id;
            await Tournament.findByIdAndDelete(tournamentId);
            res.redirect('/admins/tournaments');
        } catch (error) {
            res.status(500).send('Error deleting tournament: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
// Route to serve the edit form
app.get('/admins/tournaments/:id/edit', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const tournamentId = req.params.id;
            const tournament = await Tournament.findById(tournamentId);
            if (!tournament) {
                return res.status(404).send('Tournament not found.');
            }
            res.render('admins/editTournament', { tournament });
        } catch (error) {
            res.status(500).send('Error fetching tournament: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Route to handle the form submission for editing a tournament
app.post('/admins/tournaments/:id/edit', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const tournamentId = req.params.id;
            const { name, date, description } = req.body;
            await Tournament.findByIdAndUpdate(tournamentId, { name, date, description });
            res.redirect('/admins/tournaments');
        } catch (error) {
            res.status(500).send('Error updating tournament: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
// Route to view enrolled students for a tournament
app.get('/admins/tournaments/:id/enrolled', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const tournamentId = req.params.id;
            const tournament = await Tournament.findById(tournamentId).populate('enrollmentRequests');
            if (!tournament) {
                return res.status(404).send('Tournament not found.');
            }
            res.render('admins/enrollments', { tournament });
        } catch (error) {
            res.status(500).send('Error fetching enrolled students: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.get('/tournaments/:id/enroll', async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.send('Tournament not found.');
        }

        res.render('enroll', { tournament });
    } catch (error) {
        console.error(error);
        res.send('An error occurred while retrieving the tournament.');
    }
});

// Handle errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
app.post('/tournaments/:id/enroll', upload.single('paymentProof'), async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.send('Tournament not found.');
        }

        const { name, age, category, email, phone, studentType } = req.body;
        const paymentProof = `/images/${req.file.filename}`;

        tournament.enrollmentRequests.push({
            name,
            age,
            category,
            email,
            phone,
            studentType,
            paymentProof,
            status: 'pending' // Initially, the status is pending
        });

        await tournament.save();
        res.send('Enrollment request submitted successfully.');
    } catch (error) {
        console.error(error);
        res.send('An error occurred during enrollment.');
    }
});
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Init upload
const upload2 = multer({
    storage: storage,
    limits: {fileSize: 1000000}, // limit file size to 1MB
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
}).single('paymentProof');

// Check file type
function checkFileType(file, cb){
    // Allowed ext
    const filetypes = /jpeg|jpg|png|pdf/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb('Error: Images and PDFs Only!');
    }
}

//new code for routes 
// Mark attendance for students by admin
// // Get attendance form for students
// app.get('/admins/attendance/students', async (req, res) => {
//     if (req.session.role === 'admin') {
//         try {
//             const date = new Date().toISOString().split('T')[0];
//             const students = await User.find({ role: 'student' });
//             const notMarkedStudents = [];

//             for (const student of students) {
//                 const attendance = await Attendance.findOne({ user: student._id, date, role: 'student' });
//                 if (!attendance || attendance.status === 'Not Marked') {
//                     notMarkedStudents.push(student);
//                 }
//             }

//             res.render('admins/mark_attendance_students', { students: notMarkedStudents });
//         } catch (error) {
//             res.status(500).send('Error fetching students: ' + error.message);
//         }
//     } else {
//         res.status(403).send('Unauthorized');
//     }
// });

// Get attendance form for staff
app.get('/admins/attendance/staff', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const date = new Date().toISOString().split('T')[0];
            const staff = await User.find({ role: 'staff' });
            const notMarkedStaff = [];

            for (const staffMember of staff) {
                const attendance = await Attendance.findOne({ user: staffMember._id, date, role: 'staff' });
                if (!attendance || attendance.status === 'Not Marked') {
                    notMarkedStaff.push(staffMember);
                }
            }

            res.render('admins/mark_attendance_staff', { staff: notMarkedStaff });
        } catch (error) {
            res.status(500).send('Error fetching staff: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/admins/tournaments/:id/stop-entry', async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found', alertType: 'error' });
        }

        tournament.isEntryOpen = false;
        await tournament.save();

        res.status(200).json({ message: 'Entries have been stopped successfully.', alertType: 'success' });
    } catch (error) {
        console.error('Error stopping entries:', error);
        res.status(500).json({ message: 'Error stopping entries.', alertType: 'error' });
    }
});


// Configure multer for file uploads
const upload3 = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/results'); // Directory to save files
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`); // Unique file name
        },
    }),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, and TXT are allowed.'));
        }
    },
});

// Configure Nodemailer for email
const transporter2 = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

// Route to publish results and send emails
// Route to publish results and send emails
app.post('/admins/tournaments/:id/publish-results', upload3.single('resultFile'), async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const message = req.body.message;
        const resultFile = req.file;

        // Validate tournament
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ message: 'Tournament not found', alertType: 'error' });
        }

        // Check if entries are still open
        if (tournament.isEntryOpen) {
            return res.status(400).json({
                message: 'Results cannot be published while entries are open. Please stop entries first.',
                alertType: 'warning',
            });
        }

        // Validate approved users
        const approvedUsers = tournament.enrollmentRequests.filter(
            (user) => user.status === 'approved'
        );
        if (approvedUsers.length === 0) {
            return res.status(400).json({
                message: 'No approved users to send results to.',
                alertType: 'warning',
            });
        }

        // Save result file path and message to the tournament
        tournament.result = resultFile ? path.join('uploads/results', resultFile.filename) : null;
        tournament.message = message;
        tournament.resultsPublished = true;

        // Send emails to approved users
        const emailPromises = approvedUsers.map(async (user) => {
            const mailOptions = {
                from: 'sourav11092002@gmail.com', // Replace with your email
                to: user.email,
                subject: `Results for Tournament: ${tournament.name}`,
                text: `Dear ${user.name},\n\nThe results for the tournament "${tournament.name}" have been published.\n\n${message}\n\nBest regards,\nAdmin`,
                attachments: resultFile ? [{ path: path.resolve(tournament.result) }] : [], // Attach result file if available
            };

            try {
                await transporter2.sendMail(mailOptions);
                tournament.resultsSentTo.push(user.email);
            } catch (error) {
                console.error(`Failed to send email to ${user.email}:`, error);
            }
        });

        // Wait for all emails to complete
        await Promise.all(emailPromises);

        // Save tournament updates
        await tournament.save();

        res.status(200).json({
            message: 'Results published and sent to approved users successfully.',
            alertType: 'success',
        });
    } catch (error) {
        console.error('Error publishing results:', error);
        res.status(500).json({ message: 'Error publishing results.', alertType: 'error' });
    }
});


// Post attendance for students
// app.post('/admins/attendance/students', async (req, res) => {
//     if (req.session.role === 'admin') {
//         try {
//             const attendanceUpdates = req.body.attendance || {};
//             const date = new Date().toISOString().split('T')[0];

//             for (const [userId, status] of Object.entries(attendanceUpdates)) {
//                 let attendance = await Attendance.findOne({ user: userId, date, role: 'student' });

//                 if (!attendance) {
//                     attendance = new Attendance({
//                         user: userId,
//                         date,
//                         status,
//                         role: 'student',
//                         markedBy: req.session.userId
//                     });
//                 } else if (attendance.status === 'Not Marked') {
//                     attendance.status = status;
//                 } else {
//                     continue; // Skip updating already marked attendance
//                 }

//                 await attendance.save();

//                 const user = await User.findById(userId);
//                 if (!user.attendance.includes(attendance._id)) {
//                     user.attendance.push(attendance._id);
//                     await user.save();
//                 }
//             }

//             res.redirect('/admins/attendance/students');
//         } catch (error) {
//             res.status(500).send('Error marking attendance: ' + error.message);
//         }
//     } else {
//         res.status(403).send('Unauthorized');
//     }
// });

// Post attendance for staff
app.post('/admins/attendance/staff', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const attendanceUpdates = req.body.attendance || {};
            const date = new Date().toISOString().split('T')[0];

            for (const [userId, status] of Object.entries(attendanceUpdates)) {
                let attendance = await Attendance.findOne({ user: userId, date, role: 'staff' });

                if (!attendance) {
                    attendance = new Attendance({
                        user: userId,
                        date,
                        status,
                        role: 'staff',
                        markedBy: req.session.userId
                    });
                } else if (attendance.status === 'Not Marked') {
                    attendance.status = status;
                } else {
                    continue; // Skip updating already marked attendance
                }

                await attendance.save();

                const user = await User.findById(userId);
                if (!user.attendance.includes(attendance._id)) {
                    user.attendance.push(attendance._id);
                    await user.save();
                }
            }

            res.redirect('/admins/attendance/staff');
        } catch (error) {
            res.status(500).send('Error marking attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Route to view today's attendance for students
app.get('/admins/todays-attendance/students', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const date = new Date().toISOString().split('T')[0];
            const students = await User.find({ role: 'student' }).populate({
                path: 'attendance',
                match: { date: date, role: 'student' }
            });

            res.render('admins/todays_attendance_students', { students });
        } catch (error) {
            res.status(500).send('Error fetching students attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Route to view today's attendance for staff
app.get('/admins/todays-attendance/staff', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const date = new Date().toISOString().split('T')[0];
            const staff = await User.find({ role: 'staff' }).populate({
                path: 'attendance',
                match: { date: date, role: 'staff' }
            });

            res.render('admins/todays_attendance_staff', { staff });
        } catch (error) {
            res.status(500).send('Error fetching staff attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
// Route to view a student's attendance records
app.get('/students/attendance-records', async (req, res) => {
    if (req.session.role === 'student') {
        try {
            const userId = req.session.userId;
            const student = await User.findById(userId).populate({
                path: 'attendance',
                match: { date: { $gte: new Date().setDate(new Date().getDate() - 30) } }, // Adjust this as needed to show records for the past 30 days
                select: 'date status'
            });

            res.render('students/attendance_records', { student });
        } catch (error) {
            res.status(500).send('Error fetching attendance records: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

app.get('/students/announcements', async (req, res) => {
    if (req.session.role === 'student') {
        try {
            const { startDate, endDate } = req.query;
            const filter = {};

            if (startDate && endDate) {
                filter.date = { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                };
            }

            const announcements = await Announcement.find(filter).populate('createdBy', 'name uid');
            res.render('students/announcements', { announcements });
        } catch (error) {
            res.status(500).send('Error fetching announcements: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});



// // Route for staff to mark attendance for students
// app.get('/staff/attendance/students', async (req, res) => {
//     if (req.session.role === 'staff') {
//         try {
//             const date = new Date().toISOString().split('T')[0];
//             const students = await User.find({ role: 'student' });
//             const notMarkedStudents = [];

//             for (const student of students) {
//                 const attendance = await Attendance.findOne({ user: student._id, date, role: 'student' });
//                 if (!attendance || attendance.status === 'Not Marked') {
//                     notMarkedStudents.push(student);
//                 }
//             }

//             res.render('staff/mark_attendance_students', { students: notMarkedStudents });
//         } catch (error) {
//             res.status(500).send('Error fetching students: ' + error.message);
//         }
//     } else {
//         res.status(403).send('Unauthorized');
//     }
// });

// // Route for staff to submit marked attendance
// app.post('/staff/attendance/students', async (req, res) => {
//     if (req.session.role === 'staff') {
//         try {
//             const attendanceUpdates = req.body.attendance || {};
//             const date = new Date().toISOString().split('T')[0];

//             for (const [userId, status] of Object.entries(attendanceUpdates)) {
//                 let attendance = await Attendance.findOne({ user: userId, date, role: 'student' });

//                 if (!attendance) {
//                     attendance = new Attendance({
//                         user: userId,
//                         date,
//                         status,
//                         role: 'student',
//                         markedBy: req.session.userId
//                     });
//                 } else if (attendance.status === 'Not Marked') {
//                     attendance.status = status;
//                 } else {
//                     continue; // Skip updating already marked attendance
//                 }

//                 await attendance.save();

//                 const user = await User.findById(userId);
//                 if (!user.attendance.includes(attendance._id)) {
//                     user.attendance.push(attendance._id);
//                     await user.save();
//                 }
//             }

//             res.redirect('/staff/attendance/students');
//         } catch (error) {
//             res.status(500).send('Error marking attendance: ' + error.message);
//         }
//     } else {
//         res.status(403).send('Unauthorized');
//     }
// });


const markAttendance = async (attendanceUpdates, markerRole, markerId) => {
    const date = new Date().toISOString().split('T')[0];

    try {
        for (const [studentId, status] of Object.entries(attendanceUpdates)) {
            if (!['Present', 'Absent', 'Not Marked'].includes(status)) {
                throw new Error(`Invalid attendance status '${status}' for student ID ${studentId}`);
            }

            let attendance = await Attendance.findOne({ user: studentId, date, role: 'student' });

            if (!attendance) {
                attendance = new Attendance({
                    user: studentId,
                    date,
                    status,
                    role: 'student',
                    markedBy: markerId,
                });
            } else if (attendance.status === 'Not Marked') {
                attendance.status = status;
                attendance.markedBy = markerId;
            } else {
                continue; // Skip updating already marked attendance
            }

            await attendance.save();

            const student = await User.findById(studentId);
            if (!student) {
                throw new Error(`Student not found with ID ${studentId}`);
            }

            if (!student.attendance.includes(attendance._id)) {
                student.attendance.push(attendance._id);
                await student.save();
            }
        }
    } catch (error) {
        console.error('Error in markAttendance:', error.message);
        throw new Error('Failed to mark attendance. Please try again.');
    }
};

// Routes

// Staff: GET Route for Viewing Students
app.get('/staff/attendance/students', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized access.');
    }

    try {
        const date = new Date().toISOString().split('T')[0];
        const students = await User.find({ role: 'student' });
        const notMarkedStudents = [];

        for (const student of students) {
            const attendance = await Attendance.findOne({ user: student._id, date, role: 'student' });
            if (!attendance || attendance.status === 'Not Marked') {
                notMarkedStudents.push({
                    ...student.toObject(),
                    status: attendance ? attendance.status : 'Not Marked'
                });
            }
        }

        const message = req.session.message;
        delete req.session.message;

        res.render('staff/mark_attendance_students', { 
            students: notMarkedStudents,
            date: new Date().toISOString().split('T')[0],
            message: message
        });
    } catch (error) {
        console.error('Error fetching students for attendance:', error.message);
        res.status(500).send('Failed to fetch students. Please try again later.');
    }
});

// Staff: POST Route for Submitting Attendance
app.post('/staff/attendance/students', async (req, res) => {
    if (req.session.role !== 'staff') {
        console.error('Unauthorized access attempt:', req.session);
        return res.status(403).send('Unauthorized access.');
    }

    try {
        console.log('Request body:', req.body);
        console.log('Request body type:', typeof req.body);
        console.log('Attendance data:', req.body.attendance);
        
        const attendanceUpdates = req.body.attendance || {};
        
        // Validate attendance data
        if (Object.keys(attendanceUpdates).length === 0) {
            console.error('No attendance data found in request');
            console.error('Full request body:', JSON.stringify(req.body, null, 2));
            throw new Error('No attendance data provided');
        }

        // Log attendance updates for debugging
        console.log('Attendance updates:', attendanceUpdates);
        console.log('Staff ID:', req.session.userId);

        // Mark attendance using the helper function
        await markAttendance(attendanceUpdates, 'staff', req.session.userId);

        // Redirect with success message
        req.session.message = { type: 'success', text: 'Attendance marked successfully' };
        res.redirect('/staff/dashboard');
    } catch (error) {
        console.error('Error marking attendance:', error);
        
        // Send detailed error message in development, generic in production
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Failed to mark attendance. Please try again.';
        
        req.session.message = { type: 'error', text: errorMessage };
        res.redirect('/staff/attendance/students');
    }
});

// Admin: GET Route for Viewing Students
app.get('/admins/attendance/students', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized access.');
    }

    try {
        const date = new Date().toISOString().split('T')[0];
        const students = await User.find({ role: 'student' });
        const notMarkedStudents = [];

        for (const student of students) {
            const attendance = await Attendance.findOne({ user: student._id, date, role: 'student' });
            if (!attendance || attendance.status === 'Not Marked') {
                notMarkedStudents.push(student);
            }
        }

        res.render('admins/mark_attendance_students', { students: notMarkedStudents });
    } catch (error) {
        console.error('Error fetching students for admin attendance:', error.message);
        res.status(500).send('Failed to fetch students. Please try again later.');
    }
});

// Admin: POST Route for Submitting Attendance
app.post('/admins/attendance/students', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized access.');
    }

    try {
        const attendanceUpdates = req.body.attendance || {};
        await markAttendance(attendanceUpdates, 'admin', req.session.userId);
        res.redirect('/admins/attendance/students');
    } catch (error) {
        console.error('Error marking admin attendance:', error.message);
        res.status(500).send(error.message);
    }
});


// Route for staff to view their own attendance records

app.get('/staff/attendance-records', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const userId = req.session.userId;
            const staff = await User.findById(userId).populate({
                path: 'attendance',
                match: { date: { $gte: new Date().setDate(new Date().getDate() - 30) } }, // Adjust this as needed to show records for the past 30 days
                select: 'date status'
            });

            res.render('staff/attendance_records', { staff });
        } catch (error) {
            res.status(500).send('Error fetching attendance records: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});



//route for admin to view pending attendence requestes



//staff attendence request route
app.get('/staff/attendance-rectification', (req, res) => {
    if (req.session.role === 'staff') {
        res.render('staff/attendance-rectification');
    } else {
        res.status(403).send('Unauthorized');
    }
});


app.post('/staff/attendance-rectification', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const { date, reason } = req.body;
            const userId = req.session.userId;

            const rectificationRequest = new RectificationRequest({ user: userId, date, reason });
            await rectificationRequest.save();

            const user = await User.findById(userId);

            // Debugging statements
            if (!user) {
                return res.status(404).send('User not found.');
            }

            if (!user.rectificationRequests) {
                user.rectificationRequests = []; // Initialize if undefined
            }

            user.rectificationRequests.push(rectificationRequest._id);
            await user.save();

            res.send('Rectification request submitted successfully.');
        } catch (error) {
            res.status(500).send('Error submitting rectification request: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});


// Route to view rectification request status
app.get('/staff/attendance-rectification/status', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const userId = req.session.userId;
            const user = await User.findById(userId).populate('rectificationRequests');

            res.render('staff/rectification_status', { requests: user.rectificationRequests });
        } catch (error) {
            res.status(500).send('Error fetching rectification status: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/staff/attendance/:date/update', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const { date } = req.params;
            const { attendance } = req.body;

            const formattedDate = new Date(date);
            if (isNaN(formattedDate.getTime())) {
                return res.status(400).send('Invalid date.');
            }

            for (const studentId in attendance) {
                const status = attendance[studentId];
                await Attendance.findOneAndUpdate(
                    { user: studentId, date: formattedDate, role: 'student' },
                    { status: status, markedBy: req.session.userId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }

            res.send('Attendance updated successfully.');
        } catch (error) {
            res.status(500).send('Error updating attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Route to update attendance after admin approval
app.post('/staff/attendance-rectification/:requestId/update', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const { requestId } = req.params;
            const { attendance } = req.body;

            const request = await RectificationRequest.findById(requestId).populate('user');

            if (!request) {
                return res.status(404).send('Request not found.');
            }

            if (request.status !== 'approved') {
                return res.status(403).send('Request not approved.');
            }

            const date = new Date(request.date);
            if (isNaN(date.getTime())) {
                return res.status(400).send('Invalid date.');
            }

            for (const studentId in attendance) {
                const status = attendance[studentId];
                await Attendance.findOneAndUpdate(
                    { user: studentId, date: date },
                    { status: status, markedBy: req.session.userId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }

            res.send('Attendance updated successfully.');
        } catch (error) {
            res.status(500).send('Error updating attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
// Route for admin to view rectification requests
app.get('/admins/attendance-rectification/requests', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const requests = await RectificationRequest.find({ status: 'pending' }).populate('user');
            res.render('admins/rectification_requests', { requests });
        } catch (error) {
            res.status(500).send('Error fetching rectification requests: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});


// Route for admin to approve or decline rectification requests
app.post('/admin/attendance-rectification/:requestId/approve', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const { requestId } = req.params;
            const { action } = req.body; // 'approve' or 'decline'
            const request = await RectificationRequest.findById(requestId);

            if (action === 'approve') {
                request.status = 'approved';
            } else if (action === 'decline') {
                request.status = 'declined';
            }

            await request.save();
            res.send('Request status updated successfully.');
        } catch (error) {
            res.status(500).send('Error updating request status: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// route to attendence update page for staff
app.get('/staff/attendance-rectification/:requestId/update', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const { requestId } = req.params;
            const rectificationRequest = await RectificationRequest.findById(requestId).populate('user').populate('date');
            const students = await User.find({ role: 'student' });

            const attendanceRecords = await Attendance.find({ date: rectificationRequest.date });

            const attendanceMap = {};
            attendanceRecords.forEach(record => {
                attendanceMap[record.user.toString()] = record.status;
            });

            students.forEach(student => {
                student.currentStatus = attendanceMap[student._id.toString()] || 'Not Marked';
            });

            res.render('staff/update_attendance', {
                students,
                date: rectificationRequest.date,
                requestId,
                rectificationRequest // Pass the request to the view
            });
        } catch (error) {
            res.status(500).send('Error fetching attendance data: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

app.post('/staff/attendance-rectification/:requestId/save', async (req, res) => {
    if (req.session.role === 'staff') {
        try {
            const { requestId } = req.params;
            const { attendance } = req.body;

            if (!attendance || typeof attendance !== 'object') {
                console.error('Invalid attendance data:', attendance);
                return res.status(400).send('Invalid attendance data.');
            }

            console.log('Attendance data received:', attendance);

            const request = await RectificationRequest.findById(requestId);
            if (!request) {
                console.error('Rectification request not found:', requestId);
                return res.status(404).send('Rectification request not found.');
            }

            if (request.status !== 'approved') {
                console.error('Request not approved:', requestId);
                return res.status(403).send('Request not approved.');
            }

            const date = new Date(request.date).toISOString().split('T')[0];

            for (const [userId, status] of Object.entries(attendance)) {
                const updatedAttendance = await Attendance.findOneAndUpdate(
                    { user: userId, date, role: 'student' },
                    { status, markedBy: req.session.userId },
                    { upsert: true, new: true }
                );

                if (!updatedAttendance) {
                    console.error('Failed to update attendance record:', userId);
                } else {
                    console.log('Updated attendance record:', updatedAttendance);
                }
            }

            request.attendanceUpdated = true; // Mark the attendance as updated
            await request.save();

            res.send('Attendance updated successfully.');
        } catch (error) {
            console.error('Error updating attendance:', error);
            res.status(500).send('Error updating attendance: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});

// News Code 
app.use('/uploads', express.static('uploads'));

const newsmulter = require('multer');

const newsStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads/news_media'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const uploadNewsMedia = multer({ storage: newsStorage });

app.get('/admins/news', async (req, res) => {
    if (req.session.role === 'admin') {
        const newsList = await News.find();
        res.render('admins/news', { newsList });
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/admins/news', uploadNewsMedia.single('media'), async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const { title, date, location, description } = req.body;
            const media = req.file ? `/uploads/news_media/${req.file.filename}` : null;
            const mediaType = req.file ? (req.file.mimetype.startsWith('image') ? 'image' : 'video') : null;

            const newNews = new News({ title, date, location, description, media, mediaType });
            await newNews.save();

            res.redirect('/admins/news');
        } catch (error) {
            res.status(500).send('Error creating news: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/admins/news/:id/edit', uploadNewsMedia.single('media'), async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const { title, date, location, description } = req.body;
            const news = await News.findById(req.params.id);

            if (!news) return res.status(404).send('News not found');

            if (req.file) {
                const fs = require('fs');
                if (news.media) fs.unlinkSync(`.${news.media}`); // Delete old file

                news.media = `/uploads/news_media/${req.file.filename}`;
                news.mediaType = req.file.mimetype.startsWith('image') ? 'image' : 'video';
            }

            news.title = title || news.title;
            news.date = date || news.date;
            news.location = location || news.location;
            news.description = description || news.description;

            await news.save();
            res.redirect('/admins/news');
        } catch (error) {
            res.status(500).send('Error editing news: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.post('/admins/news/:id/delete', async (req, res) => {
    if (req.session.role === 'admin') {
        try {
            const news = await News.findById(req.params.id);
            if (news.media) {
                const fs = require('fs');
                fs.unlinkSync(`.${news.media}`); // Delete media file
            }

            await News.findByIdAndDelete(req.params.id);
            res.redirect('/admins/news');
        } catch (error) {
            res.status(500).send('Error deleting news: ' + error.message);
        }
    } else {
        res.status(403).send('Unauthorized');
    }
});
app.get('/news_events', async (req, res) => {
    try {
        const newsEvents = await News.find(); // Fetch all news events from the database
        res.render('news_events', { newsEvents }); // Pass the fetched newsEvents to the view
    } catch (error) {
        console.error('Error fetching news events:', error);
        res.status(500).send('An error occurred while fetching news events.');
    }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});



// removable code 
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthreport', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'healthreport.html')); // Serve a static form file
    // OR render using a template engine like EJS:
    // res.render('healthreport'); 
});

// Route to handle form submission
app.post('/healthreport', (req, res) => {
    const { studentId, reportDetails, date } = req.body;
    // Logic to handle form submission (e.g., save to database)
    console.log(`Student ID: ${studentId}, Report: ${reportDetails}, Date: ${date}`);
    res.send('Health report submitted successfully!');
});
// Route to render the Performance Report form
app.get('/performancereport', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'performancereport.html')); // Serve the static form
    // OR use a template engine like EJS:
    // res.render('performancereport'); 
});

// Route to handle Performance Report form submission
app.post('/performancereport', (req, res) => {
    const { studentId, performanceDetails, evaluationDate } = req.body;

    // Logic to process and store the performance report data
    console.log(`Student ID: ${studentId}, Performance: ${performanceDetails}, Date: ${evaluationDate}`);

    // Send a response
    res.send('Performance report submitted successfully!');
});
app.get('/healthreport', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'health.html')); // Serve a static form file
    // OR render using a template engine like EJS:
    // res.render('healthreport'); 
});
app.get('/health', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'health.html')); // Serving static HTML
});
app.get('/performance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'performance.html')); // Serving static HTML
});
app.get('/timetable', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timetable.html')); // Serve static HTML form
    // OR render using a template engine like EJS:
    // res.render('timetable'); 
});

// Admin routes
app.get('/admin/timetable', async (req, res) => {
  try {
    if (!req.session.userId || req.session.role !== 'admin') {
      return res.redirect('/login');
    }
    
    // Get the current user
    const user = await User.findById(req.session.userId);
    
    // Get all classes and teachers
    const classes = await Class.find().sort({ name: 1 });
    const teachers = await User.find({ role: 'staff' }).sort({ name: 1 });
    
    res.render('admin/timetable', { user, classes, teachers });
  } catch (error) {
    console.error('Error loading timetable page:', error);
    res.status(500).send('Error loading timetable page');
  }
});

// Admin route for user registration
app.get('/admins/register-user', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
    const user = await User.findById(req.session.userId);
    res.render('signup', { user });
});

app.post('/admins/register-user', upload.single('image'), async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    
    try {
        const { name, age, role, sex, email, mobileNumber, password, confirmPassword } = req.body;
        const image = req.file;

        if (!name || !age || !role || !sex || !email || !mobileNumber || !password || !confirmPassword || !image) {
            return res.render('admins/registerUser', { error: 'All fields are required.' });
        }

        if (password !== confirmPassword) {
            return res.render('admins/registerUser', { error: 'Passwords do not match.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('admins/registerUser', { error: 'Email is already registered.' });
        }

        // Generate UID based on role
        let uid;
        if (role === 'student') {
            uid = 'S' + Math.floor(10000 + Math.random() * 90000);
        } else if (role === 'staff') {
            uid = 'T' + Math.floor(100 + Math.random() * 900);
        } else if (role === 'admin') {
            uid = 'A' + Math.floor(1000 + Math.random() * 9000);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            name,
            age,
            role,
            sex,
            email,
            mobileNumber,
            password: hashedPassword,
            uid,
            image: `/images/${image.filename}`,
            active: true
        });

        await newUser.save();
        
        // Redirect to manage users page with success message
        res.redirect('/admins/manage-users?success=User registered successfully');
    } catch (error) {
        console.error('Error registering user:', error);
        res.render('admins/registerUser', { error: 'An error occurred during registration.' });
    }
});

// View user details
app.get('/admins/users/:id/view', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.redirect('/login');
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/admins/users');
        }

        res.render('admins/viewUser', { user });
    } catch (error) {
        console.error('Error viewing user:', error);
        req.flash('error', 'Error viewing user details');
        res.redirect('/admins/users');
    }
});

// Timetable Routes
app.get('/api/timetable/class/:classId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { classId } = req.params;
        const { section, academicYear } = req.query;

        const query = { class: classId };
        if (section) query.section = section;
        if (academicYear) query.academicYear = academicYear;

        const timetable = await Timetable.findOne(query)
            .populate('periods.teacher', 'name uid')
            .populate('firstPeriodTeacher', 'name uid');

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found' });
        }

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/timetable/period/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const timetable = await Timetable.findOne({
            'periods._id': req.params.id
        }).populate('periods.teacher', 'name uid');

        if (!timetable) {
            return res.status(404).json({ message: 'Period not found' });
        }

        const period = timetable.periods.id(req.params.id);
        res.json(period);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/timetable', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { classId, section, academicYear, periods, firstPeriodTeacherId } = req.body;

        // Find the first period teacher
        const firstPeriodTeacher = await User.findOne({ 
            _id: firstPeriodTeacherId,
            role: 'staff'
        });

        if (!firstPeriodTeacher) {
            return res.status(400).json({ message: 'First period teacher not found' });
        }

        let timetable = await Timetable.findOne({ 
            class: classId, 
            section, 
            academicYear 
        });

        if (timetable) {
            // Update existing timetable
            timetable.periods = periods;
            timetable.firstPeriodTeacher = firstPeriodTeacherId;
            timetable.updatedAt = Date.now();
        } else {
            // Create new timetable
            timetable = new Timetable({
                class: classId,
                section,
                academicYear,
                periods,
                firstPeriodTeacher: firstPeriodTeacherId
            });
        }

        await timetable.save();
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/timetable/:id', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { subject, teacherId, startTime, endTime } = req.body;
        const timetable = await Timetable.findOne({
            'periods._id': req.params.id
        });

        if (!timetable) {
            return res.status(404).json({ message: 'Period not found' });
        }

        const period = timetable.periods.id(req.params.id);
        period.subject = subject;
        period.teacher = teacherId;
        period.startTime = startTime;
        period.endTime = endTime;
        timetable.updatedAt = Date.now();

        await timetable.save();
        res.json(period);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/timetable/:id', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const timetable = await Timetable.findOne({
            'periods._id': req.params.id
        });

        if (!timetable) {
            return res.status(404).json({ message: 'Period not found' });
        }

        timetable.periods.pull(req.params.id);
        timetable.updatedAt = Date.now();
        await timetable.save();

        res.json({ message: 'Period deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Attendance Routes
app.post('/api/attendance/mark', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { classId, section, date, attendanceData } = req.body;

        // Get the timetable for this class and section
        const timetable = await Timetable.findOne({ 
            class: classId,
            section
        }).populate('firstPeriodTeacher');

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found' });
        }

        // Check if the user is the first period teacher or an admin
        const user = await User.findById(req.session.userId);
        if (user.role !== 'admin' && timetable.firstPeriodTeacher._id.toString() !== req.session.userId) {
            return res.status(403).json({ 
                message: 'Only the first period teacher or admin can mark attendance' 
            });
        }

        // Create or update attendance records
        const attendance = await Attendance.findOneAndUpdate(
            { class: classId, section, date },
            { 
                $set: { 
                    attendanceData,
                    markedBy: req.session.userId,
                    updatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        res.status(201).json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/attendance/class/:classId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { classId } = req.params;
        const { section, date } = req.query;

        const query = { class: classId };
        if (section) query.section = section;
        if (date) query.date = date;

        const attendance = await Attendance.find(query)
            .populate('markedBy', 'name uid')
            .sort('-date');

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/attendance/student/:studentId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { studentId } = req.params;
        const { startDate, endDate } = req.query;

        const query = { 'attendanceData.student': studentId };
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendance = await Attendance.find(query)
            .populate('markedBy', 'name uid')
            .sort('-date');

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Performance Routes
app.get('/api/performance/student/:studentId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        const reports = await PerformanceReport.find({ studentId: req.params.studentId })
            .sort({ academicYear: -1, term: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/performance/class/:classId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        const { academicYear, term } = req.query;
        const query = { classId: req.params.classId };
        
        if (academicYear) query.academicYear = academicYear;
        if (term) query.term = term;
        
        const reports = await PerformanceReport.find(query)
            .populate('studentId', 'name rollNumber')
            .sort({ 'academicPerformance.average': -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/performance', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'teacher') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const {
            studentId,
            classId,
            academicYear,
            term,
            academicPerformance,
            behavioralPerformance,
            teacherRemarks
        } = req.body;
        
        // Calculate total marks and average
        const totalMarks = academicPerformance.subjects.reduce((sum, subject) => sum + subject.marks, 0);
        const average = totalMarks / academicPerformance.subjects.length;
        
        const report = new PerformanceReport({
            studentId,
            classId,
            academicYear,
            term,
            academicPerformance: {
                ...academicPerformance,
                totalMarks,
                average
            },
            behavioralPerformance,
            teacherRemarks
        });
        
        await report.save();
        res.status(201).json(report);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.patch('/api/performance/:id/parent-remarks', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        const report = await PerformanceReport.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: 'Performance report not found' });
        }
        
        report.parentRemarks = req.body.remarks;
        report.updatedAt = new Date();
        await report.save();
        
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== Attendance Routes ====================

// Admin: View attendance marking page for students
app.get('/admins/attendance/students', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const date = new Date().toISOString().split('T')[0];
        const students = await User.find({ role: 'student' });
        const notMarkedStudents = [];

        for (const student of students) {
            const attendance = await Attendance.findOne({ 
                user: student._id, 
                date, 
                role: 'student' 
            });
            if (!attendance || attendance.status === 'Not Marked') {
                notMarkedStudents.push(student);
            }
        }

        res.render('admins/mark_attendance_students', { 
            students: notMarkedStudents,
            date,
            user: await User.findById(req.session.userId)
        });
    } catch (error) {
        res.status(500).send('Error fetching students: ' + error.message);
    }
});

// Admin: Mark attendance for students
app.post('/admins/attendance/students', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const attendanceUpdates = req.body.attendance || {};
        await markAttendance(attendanceUpdates, 'admin', req.session.userId);
        res.redirect('/admins/attendance/students');
    } catch (error) {
        res.status(500).send('Error marking attendance: ' + error.message);
    }
});

// Staff: View attendance marking page for students
app.get('/staff/attendance/students', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }

    try {
        const date = new Date().toISOString().split('T')[0];
        const students = await User.find({ role: 'student' });
        const notMarkedStudents = [];

        for (const student of students) {
            const attendance = await Attendance.findOne({ 
                user: student._id, 
                date, 
                role: 'student' 
            });
            if (!attendance || attendance.status === 'Not Marked') {
                notMarkedStudents.push({
                    ...student.toObject(),
                    status: attendance ? attendance.status : 'Not Marked'
                });
            }
        }

        const message = req.session.message;
        delete req.session.message;

        res.render('staff/mark_attendance_students', { 
            students: notMarkedStudents,
            date: new Date().toISOString().split('T')[0],
            message
        });
    } catch (error) {
        console.error('Error fetching students for attendance:', error.message);
        res.status(500).send('Failed to fetch students. Please try again later.');
    }
});

// Staff: Mark attendance for students
app.post('/staff/attendance/students', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const staff = await User.findById(req.session.userId);
        if (!staff) {
            req.session.message = { type: 'error', text: 'Staff member not found' };
            return res.redirect('/staff/dashboard');
        }

        const date = new Date().toISOString().split('T')[0];
        const attendanceUpdates = req.body.attendance || {};
        
        // Verify staff has classes today
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        const timetables = await Timetable.find({
            'days': {
                $elemMatch: {
                    'day': dayOfWeek,
                    'periods.teacher': staff._id
                }
            }
        });

        if (!timetables.length) {
            req.session.message = { type: 'error', text: 'You have no classes assigned for today' };
            return res.redirect('/staff/dashboard');
        }

        // Get authorized students
        const students = await User.find({
            role: 'student',
            $or: timetables.map(t => ({
                class: t.class,
                section: t.section
            }))
        });

        const studentIds = students.map(s => s._id.toString());
        let markedCount = 0;

        // Process attendance updates
        for (const [studentId, status] of Object.entries(attendanceUpdates)) {
            if (!studentIds.includes(studentId) || !['Present', 'Absent', 'Not Marked'].includes(status)) {
                continue;
            }

            const attendance = await Attendance.findOneAndUpdate(
                {
                    user: studentId,
                    date: {
                        $gte: new Date(date),
                        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
                    }
                },
                {
                    $set: {
                        status,
                        markedBy: staff._id,
                        updatedAt: new Date()
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );

            // Update student's attendance array if needed
            await User.findByIdAndUpdate(
                studentId,
                {
                    $addToSet: { attendance: attendance._id }
                }
            );

            markedCount++;
        }

        req.session.message = {
            type: 'success',
            text: `Successfully marked attendance for ${markedCount} student(s)`
        };

        res.redirect('/staff/attendance/students');
    } catch (error) {
        console.error('Error marking attendance:', error);
        req.session.message = {
            type: 'error',
            text: 'Failed to mark attendance. Please try again.'
        };
        res.redirect('/staff/attendance/students');
    }
});

// ==================== Rectification Request Routes ====================

// Staff: View rectification request form
app.get('/staff/attendance-rectification', (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    res.render('staff/attendance-rectification', { 
        user: req.session.userId 
    });
});

// Staff: Submit rectification request
app.post('/staff/attendance-rectification', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const { date, reason } = req.body;
        const userId = req.session.userId;

        const rectificationRequest = new RectificationRequest({ 
            user: userId, 
            date, 
            reason 
        });
        await rectificationRequest.save();

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }

        if (!user.rectificationRequests) {
            user.rectificationRequests = [];
        }

        user.rectificationRequests.push(rectificationRequest._id);
        await user.save();

        res.redirect('/staff/attendance-rectification/status');
    } catch (error) {
        res.status(500).send('Error submitting rectification request: ' + error.message);
    }
});

// Staff: View rectification request status
app.get('/staff/attendance-rectification/status', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId).populate('rectificationRequests');
        res.render('staff/rectification_status', { 
            requests: user.rectificationRequests,
            user: user
        });
    } catch (error) {
        res.status(500).send('Error fetching rectification status: ' + error.message);
    }
});

// Admin: View pending rectification requests
app.get('/admins/attendance-rectification/requests', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const requests = await RectificationRequest.find({ status: 'pending' })
            .populate('user')
            .sort('-requestDate');
        res.render('admins/rectification_requests', { 
            requests,
            user: await User.findById(req.session.userId)
        });
    } catch (error) {
        res.status(500).send('Error fetching rectification requests: ' + error.message);
    }
});

// Admin: Approve/Decline rectification request
app.post('/admin/attendance-rectification/:requestId/approve', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const { requestId } = req.params;
        const { action } = req.body;
        const request = await RectificationRequest.findById(requestId);

        if (action === 'approve') {
            request.status = 'approved';
        } else if (action === 'decline') {
            request.status = 'declined';
        }

        await request.save();
        res.send('Request status updated successfully.');
    } catch (error) {
        res.status(500).send('Error updating request status: ' + error.message);
    }
});

// Staff: Update attendance after rectification approval
app.get('/staff/attendance-rectification/:requestId/update', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const { requestId } = req.params;
        const request = await RectificationRequest.findById(requestId)
            .populate('user');

        if (!request) {
            return res.status(404).send('Request not found.');
        }

        if (request.status !== 'approved') {
            return res.status(403).send('Request not approved.');
        }

        const students = await User.find({ role: 'student' });
        const attendanceRecords = await Attendance.find({ 
            date: request.date 
        });

        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            attendanceMap[record.user.toString()] = record.status;
        });

        students.forEach(student => {
            student.currentStatus = attendanceMap[student._id.toString()] || 'Not Marked';
        });

        res.render('staff/update_attendance', {
            students,
            date: request.date,
            requestId,
            request,
            user: await User.findById(req.session.userId)
        });
    } catch (error) {
        res.status(500).send('Error fetching attendance data: ' + error.message);
    }
});

// Staff: Save updated attendance after rectification
app.post('/staff/attendance-rectification/:requestId/save', async (req, res) => {
    if (req.session.role !== 'staff') {
        return res.status(403).send('Unauthorized');
    }
    try {
        const { requestId } = req.params;
        const { attendance } = req.body;

        if (!attendance || typeof attendance !== 'object') {
            return res.status(400).send('Invalid attendance data.');
        }

        const request = await RectificationRequest.findById(requestId);
        if (!request) {
            return res.status(404).send('Rectification request not found.');
        }

        if (request.status !== 'approved') {
            return res.status(403).send('Request not approved.');
        }

        const date = new Date(request.date).toISOString().split('T')[0];

        for (const [userId, status] of Object.entries(attendance)) {
            await Attendance.findOneAndUpdate(
                { user: userId, date, role: 'student' },
                { status, markedBy: req.session.userId },
                { upsert: true, new: true }
            );
        }

        request.attendanceUpdated = true;
        await request.save();

        res.redirect('/staff/attendance-rectification/status');
    } catch (error) {
        res.status(500).send('Error updating attendance: ' + error.message);
    }
});

// Staff assignment routes
app.use('/api/staff-assignments', staffAssignmentRoutes);

// Route to view staff assignment page
app.get('/admin/assign-staff', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.redirect('/login');
        }
        
        // Get the current user
        const user = await User.findById(req.session.userId);
        
        // Get all staff members
        const staff = await User.find({ role: 'staff' }).sort({ name: 1 });
        
        res.render('admins/assign_staff', { user, staff });
    } catch (error) {
        console.error('Error loading staff assignment page:', error);
        res.status(500).send('Error loading staff assignment page');
    }
});

// Staff Assignment Routes
app.get('/api/staff-assignments/class/:classId', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { classId } = req.params;
        const { academicYear } = req.query;

        const [classNum, section] = classId.split('-');
        
        const assignments = await StaffAssignment.find({
            classId: classNum,
            section,
            academicYear: academicYear || new Date().getFullYear().toString()
        }).populate('teacherId', 'name');

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/staff-assignments/teacher/:teacherId', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { teacherId } = req.params;
        const { academicYear } = req.query;

        const assignments = await StaffAssignment.find({
            teacherId,
            academicYear: academicYear || new Date().getFullYear().toString()
        });

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/staff-assignments', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { classId, subject, teacherId, academicYear } = req.body;

        // Validate teacher exists and is a staff member
        const teacher = await User.findOne({ _id: teacherId, role: 'staff' });
        if (!teacher) {
            return res.status(400).json({ message: 'Invalid teacher selected' });
        }

        // Parse class and section
        const [classNum, section] = classId.split('-');
        if (!classNum || !section) {
            return res.status(400).json({ message: 'Invalid class ID format' });
        }

        // Check if teacher is already assigned to this subject in another class
        const existingAssignment = await StaffAssignment.findOne({
            teacherId,
            subject,
            academicYear,
            _id: { $ne: req.body._id } // Exclude current assignment if updating
        });

        if (existingAssignment) {
            return res.status(400).json({ 
                message: `Teacher is already assigned to ${subject} in Class ${existingAssignment.classId}-${existingAssignment.section}` 
            });
        }

        // Create or update assignment
        const assignment = await StaffAssignment.findOneAndUpdate(
            {
                classId: classNum,
                section,
                subject,
                academicYear
            },
            {
                classId: classNum,
                section,
                subject,
                teacherId,
                academicYear
            },
            { upsert: true, new: true }
        );

        res.json(assignment);
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'This subject is already assigned to another teacher in this class' });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

app.delete('/api/staff-assignments/:id', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const assignment = await StaffAssignment.findByIdAndDelete(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route to view staff assignment page
app.get('/admin/assign-staff', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.redirect('/login');
        }
        
        // Get the current user
        const user = await User.findById(req.session.userId);
        
        // Get all staff members
        const staff = await User.find({ role: 'staff' }).sort({ name: 1 });
        
        res.render('admins/assign_staff', { user, staff });
    } catch (error) {
        console.error('Error loading staff assignment page:', error);
        res.status(500).send('Error loading staff assignment page');
    }
});