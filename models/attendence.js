const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Present', 'Absent', 'Not Marked'], default: 'Not Marked' },
    role: { type: String, required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
