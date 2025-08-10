const mongoose = require('mongoose');

const rectificationRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },  // Changed from String to Date
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
    requestDate: { type: Date, default: Date.now },
    attendanceUpdated: { type: Boolean, default: false }  // Add this field
});

const RectificationRequest = mongoose.model('RectificationRequest', rectificationRequestSchema);
module.exports = RectificationRequest;
