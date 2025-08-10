const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const announcementSchema = new Schema({
    title: String,
    content: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now }
});

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = Announcement;
