const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'staff', 'student'],
        required: true
    },
    uid: {
        type: String,
        unique: true
    },
    image: {
        type: String,
        default: '/images/default.jpg'
    },
    age: {
        type: Number,
        required: true
    },
    sex: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'male', 'female', 'other'],
        required: true,
        set: function(val) {
            // Capitalize first letter
            return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        }
    },
    mobileNumber: {
        type: String,
        required: true
    },
    // OTP fields for password reset
    otp: {
        type: String,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    },
    // Staff specific fields
    subject: {
        type: String,
        required: function() {
            return this.role === 'staff';
        },
        enum: ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Computer Science', 'Physical Education', 'Art', 'Music', 'Languages']
    },
    // Student specific fields
    parentName: {
        type: String,
        required: function() {
            return this.role === 'student';
        }
    },
    parentMobile: {
        type: String,
        required: function() {
            return this.role === 'student';
        }
    },
    class: {
        type: Number,
        min: 1,
        max: 12,
        required: function() {
            return this.role === 'student';
        }
    },
    section: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E'],
        required: function() {
            return this.role === 'student';
        },
        set: function(val) {
            // Convert to uppercase
            return val ? val.toUpperCase() : val;
        }
    },
    rollNumber: {
        type: String,
        required: function() {
            return this.role === 'student';
        }
    },
    admissionNumber: {
        type: String,
        required: function() {
            return this.role === 'student';
        }
    },
    address: {
        type: String,
        required: function() {
            return this.role === 'student';
        },
        set: function(val) {
            // If val is an array, join the elements
            if (Array.isArray(val)) {
                return val.filter(item => item).join(', ');
            }
            return val;
        }
    },
    active: {
        type: Boolean,
        default: true
    },
    attendance: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance'
    }],
    rectificationRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RectificationRequest'
    }],
    rectificationsUsed: {
        type: Number,
        default: 0
    },
    healthReportUpdated: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Pre-save middleware to generate UID
userSchema.pre('save', async function(next) {
    if (!this.uid) {
        let prefix;
        switch(this.role) {
            case 'admin':
                prefix = 'A';
                break;
            case 'staff':
                prefix = 'T';
                break;
            case 'student':
                prefix = 'S';
                break;
        }
        
        const count = await this.constructor.countDocuments({ role: this.role });
        this.uid = `${prefix}${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
