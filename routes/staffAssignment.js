const express = require('express');
const router = express.Router();
const StaffAssignment = require('../models/StaffAssignment');
const User = require('../models/User');
const Timetable = require('../models/Timetable');

// Get all assignments for a class-section-day
router.get('/:class/:section/:day/:academicYear', async (req, res) => {
    try {
        const { class: classValue, section, day, academicYear } = req.params;
        const assignments = await StaffAssignment.find({
            class: classValue,
            section,
            day,
            academicYear
        }).populate('teacher', 'name');
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all teachers
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await User.find({ role: 'staff' }).select('name');
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create or update assignment
router.post('/', async (req, res) => {
    try {
        const {
            class: classValue,
            section,
            day,
            academicYear,
            subject,
            teacher,
            timeSlot
        } = req.body;

        // Check if teacher exists
        const teacherExists = await User.findById(teacher);
        if (!teacherExists) {
            return res.status(400).json({ error: 'Teacher not found' });
        }

        // Check for existing assignment in the same time slot
        const existingAssignment = await StaffAssignment.findOne({
            class: classValue,
            section,
            day,
            academicYear,
            'timeSlot.startTime': timeSlot.startTime,
            'timeSlot.endTime': timeSlot.endTime
        });

        let assignment;
        if (existingAssignment) {
            // Update existing assignment
            existingAssignment.teacher = teacher;
            existingAssignment.subject = subject;
            assignment = await existingAssignment.save();
        } else {
            // Create new assignment
            assignment = new StaffAssignment({
                class: classValue,
                section,
                day,
                academicYear,
                subject,
                teacher,
                timeSlot
            });
            await assignment.save();
        }

        // Update the timetable
        let timetable = await Timetable.findOne({
            class: classValue,
            section,
            academicYear
        });

        if (!timetable) {
            timetable = new Timetable({
                class: classValue,
                section,
                academicYear,
                days: []
            });
        }

        // Find or create the day in the timetable
        let dayObj = timetable.days.find(d => d.day === day);
        if (!dayObj) {
            dayObj = { day, periods: [] };
            timetable.days.push(dayObj);
        }

        // Calculate period number based on time slot
        const periodNumber = calculatePeriodNumber(timeSlot.startTime);

        // Update or add the period
        const periodIndex = dayObj.periods.findIndex(p => p.periodNumber === periodNumber);
        const period = {
            periodNumber,
            subject,
            teacher,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime
        };

        if (periodIndex === -1) {
            dayObj.periods.push(period);
        } else {
            dayObj.periods[periodIndex] = period;
        }

        // Update teacher's daily class count
        const teacherDayIndex = timetable.teacherDailyClasses.findIndex(
            t => t.teacher.toString() === teacher.toString() && t.day === day
        );

        if (teacherDayIndex === -1) {
            timetable.teacherDailyClasses.push({
                teacher,
                day,
                classCount: 1
            });
        } else {
            timetable.teacherDailyClasses[teacherDayIndex].classCount += 1;
        }

        await timetable.save();
        res.json(assignment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Helper function to calculate period number based on start time
function calculatePeriodNumber(startTime) {
    const timeMap = {
        '08:00': 1,
        '08:45': 2,
        '09:30': 3,
        '10:15': 4,
        '11:00': 5,
        '11:45': 6,
        '12:30': 7,
        '13:15': 8
    };
    return timeMap[startTime] || 1;
}

// Delete assignment
router.delete('/:id', async (req, res) => {
    try {
        const assignment = await StaffAssignment.findByIdAndDelete(req.params.id);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 