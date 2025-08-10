const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    name: String,
    age: Number,
    category: String,
    email: { type: String, required: true },
    phone: String,
    studentType: String,
    paymentProof: String,
    status: { type: String, default: 'pending' }, // pending, approved, declined
    remarks: String // Optional remarks for the enrollment
});

const tournamentSchema = new mongoose.Schema({
    name: String,
    date: Date,
    description: String,
    enrollmentRequests: [enrollmentSchema], // List of enrollment requests
    result: { type: String, default: null }, // File path or text of the result
    message: { type: String, default: '' }, // Admin message for approved users
    isEntryOpen: { type: Boolean, default: true }, // Flag to indicate if entries are open
    resultsPublished: { type: Boolean, default: false }, // Flag for whether the results have been published
    resultsSentTo: { type: [String], default: [] } // List of emails of approved users who received the results
}, { timestamps: true }); // Adds createdAt and updatedAt fields

const Tournament = mongoose.model('Tournament', tournamentSchema);
module.exports = Tournament;
