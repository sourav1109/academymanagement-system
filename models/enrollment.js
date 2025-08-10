const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    age: { type: Number, required: true },
    category: { type: String, required: true },
    paymentSS: { type: String, required: true },
    approved: { type: Boolean, default: false }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
