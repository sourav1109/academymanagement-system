const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Class = require('../models/Class');
const StaffAssignment = require('../models/StaffAssignment');

// Get timetable for a class
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { academicYear } = req.query;

        const timetable = await Timetable.findOne({
            class: classId,
            academicYear: academicYear || new Date().getFullYear().toString()
        }).populate('days.periods.teacher', 'name');

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found' });
        }

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get timetable for a teacher
router.get('/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { academicYear } = req.query;

        const timetables = await Timetable.find({
            'days.periods.teacher': teacherId,
            academicYear: academicYear || new Date().getFullYear().toString()
        }).populate('days.periods.teacher', 'name');

        res.json(timetables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create or update timetable period
router.post('/', async (req, res) => {
    try {
        const { classId, day, periodNumber, subject, teacherId, startTime, endTime, academicYear } = req.body;

        let timetable = await Timetable.findOne({
            class: classId,
            academicYear: academicYear || new Date().getFullYear().toString()
        });

        if (!timetable) {
            timetable = new Timetable({
                class: classId,
                academicYear: academicYear || new Date().getFullYear().toString(),
                days: []
            });
        }

        // Find or create the day
        let dayObj = timetable.days.find(d => d.day === day);
        if (!dayObj) {
            dayObj = { day, periods: [] };
            timetable.days.push(dayObj);
        }

        // Update or add the period
        const periodIndex = dayObj.periods.findIndex(p => p.periodNumber === periodNumber);
        const period = {
            periodNumber,
            subject,
            teacher: teacherId,
            startTime,
            endTime
        };

        if (periodIndex === -1) {
            dayObj.periods.push(period);
        } else {
            dayObj.periods[periodIndex] = period;
        }

        await timetable.save();
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete timetable period
router.delete('/:periodId', async (req, res) => {
    try {
        const { periodId } = req.params;
        const { classId, day, periodNumber, academicYear } = req.query;

        const timetable = await Timetable.findOne({
            class: classId,
            academicYear: academicYear || new Date().getFullYear().toString()
        });

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found' });
        }

        const dayObj = timetable.days.find(d => d.day === day);
        if (dayObj) {
            dayObj.periods = dayObj.periods.filter(p => p.periodNumber !== parseInt(periodNumber));
            await timetable.save();
        }

        res.json({ message: 'Period deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// View complete timetable
router.get('/view', async (req, res) => {
    try {
        const { academicYear } = req.query;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeSlots = [
            { start: '08:00', end: '08:45' },
            { start: '08:45', end: '09:30' },
            { start: '09:30', end: '10:15' },
            { start: '10:15', end: '11:00' },
            { start: '11:00', end: '11:45' },
            { start: '11:45', end: '12:30' },
            { start: '12:30', end: '13:15' },
            { start: '13:15', end: '14:00' }
        ];

        // Get all assignments for the academic year
        const assignments = await StaffAssignment.find({ academicYear })
            .populate('teacher', 'name subject')
            .sort({ class: 1, section: 1, day: 1, 'timeSlot.startTime': 1 });

        // Organize assignments by class-section
        const timetable = {};
        assignments.forEach(assignment => {
            const key = `${assignment.class}-${assignment.section}`;
            if (!timetable[key]) {
                timetable[key] = {
                    class: assignment.class,
                    section: assignment.section,
                    schedule: {}
                };
            }
            if (!timetable[key].schedule[assignment.day]) {
                timetable[key].schedule[assignment.day] = {};
            }
            timetable[key].schedule[assignment.day][`${assignment.timeSlot.startTime}-${assignment.timeSlot.endTime}`] = {
                subject: assignment.subject,
                teacher: assignment.teacher.name,
                teacherSubject: assignment.teacher.subject
            };
        });

        res.render('timetable/view', {
            timetable,
            days,
            timeSlots,
            academicYear: academicYear || new Date().getFullYear().toString()
        });
    } catch (error) {
        console.error('Error loading timetable:', error);
        res.status(500).send('Error loading timetable');
    }
});

// Get timetable for a specific class-section
router.get('/class/:class/:section', async (req, res) => {
    try {
        const { class: classValue, section } = req.params;
        const { academicYear } = req.query;

        const assignments = await StaffAssignment.find({
            class: classValue,
            section,
            academicYear: academicYear || new Date().getFullYear().toString()
        }).populate('teacher', 'name subject');

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get timetable for a specific teacher
router.get('/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { academicYear } = req.query;

        const assignments = await StaffAssignment.find({
            teacher: teacherId,
            academicYear: academicYear || new Date().getFullYear().toString()
        }).populate('teacher', 'name subject');

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 