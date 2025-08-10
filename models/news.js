const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    media: { type: String }, // Path to image or video
    mediaType: { type: String } // 'image' or 'video'
}, { timestamps: true });

module.exports = mongoose.model('News', newsSchema);
