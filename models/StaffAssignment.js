const mongoose = require('mongoose');

const staffAssignmentSchema = new mongoose.Schema({
    class: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    section: {
        type: String,
        required: true,
        enum: ['A', 'B', 'C', 'D', 'E']
    },
    subject: {
        type: String,
        required: true
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    timeSlot: {
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        }
    },
    isConsecutive: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Compound index to ensure unique assignments per class-section-subject-day-timeSlot
staffAssignmentSchema.index({ 
    class: 1, 
    section: 1, 
    subject: 1, 
    day: 1, 
    'timeSlot.startTime': 1, 
    'timeSlot.endTime': 1, 
    academicYear: 1 
}, { unique: true });

// Pre-save middleware to check teacher's daily class limit
staffAssignmentSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('teacher') || this.isModified('day')) {
        const Teacher = mongoose.model('User');
        const existingAssignments = await this.constructor.find({
            teacher: this.teacher,
            day: this.day,
            academicYear: this.academicYear
        });

        if (existingAssignments.length >= 4) {
            throw new Error('Teacher cannot be assigned more than 4 classes per day');
        }

        // Check for consecutive classes
        const sortedAssignments = existingAssignments.sort((a, b) => 
            a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
        );

        for (let i = 0; i < sortedAssignments.length; i++) {
            if (i < sortedAssignments.length - 1) {
                const currentEnd = sortedAssignments[i].timeSlot.endTime;
                const nextStart = sortedAssignments[i + 1].timeSlot.startTime;
                
                if (currentEnd === nextStart) {
                    throw new Error('Teacher cannot be assigned consecutive classes');
                }
            }
        }
    }
    next();
});

const StaffAssignment = mongoose.model('StaffAssignment', staffAssignmentSchema);

module.exports = StaffAssignment; 