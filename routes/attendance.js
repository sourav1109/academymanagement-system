const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const User = require('../models/User');

// Mark attendance
router.post('/mark', async (req, res) => {
    try {
        const { classId, date, periodNumber, presentStudents } = req.body;
        const [classNum, section] = classId.split('-');
        const currentDate = new Date(date);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];

        // Get the timetable for the class
        const timetable = await Timetable.findOne({
            class: classNum,
            section,
            academicYear: new Date().getFullYear().toString()
        });

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found for this class' });
        }

        // Check if the user is admin or the assigned teacher for this period
        const daySchedule = timetable.days.find(d => d.day === dayOfWeek);
        if (!daySchedule) {
            return res.status(400).json({ message: 'No schedule found for this day' });
        }

        const period = daySchedule.periods.find(p => p.periodNumber === periodNumber);
        if (!period) {
            return res.status(400).json({ message: 'No schedule found for this period' });
        }

        // Check if user is admin or the assigned teacher
        if (req.user.role !== 'admin' && period.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not authorized to mark attendance for this period' });
        }

        // Create or update attendance record
        let attendance = await Attendance.findOne({
            class: classNum,
            section,
            date,
            periodNumber
        });

        if (attendance) {
            attendance.presentStudents = presentStudents;
            attendance.markedBy = req.user._id;
        } else {
            attendance = new Attendance({
                class: classNum,
                section,
                date,
                periodNumber,
                presentStudents,
                markedBy: req.user._id
            });
        }

        await attendance.save();
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get attendance for a class
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const { date } = req.query;
        const [classNum, section] = classId.split('-');

        const query = {
            class: classNum,
            section
        };

        if (date) {
            query.date = date;
        }

        const attendance = await Attendance.find(query)
            .populate('markedBy', 'name')
            .sort({ date: -1, periodNumber: 1 });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get attendance for a student
router.get('/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { startDate, endDate } = req.query;

        const query = {
            'presentStudents': studentId
        };

        if (startDate && endDate) {
            query.date = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const attendance = await Attendance.find(query)
            .sort({ date: -1, periodNumber: 1 });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 