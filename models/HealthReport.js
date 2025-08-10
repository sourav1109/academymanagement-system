const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HealthReportSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parameters: {
    param1: { type: Number, required: true, min: 0, max: 10 },
    param2: { type: Number, required: true, min: 0, max: 10 },
    param3: { type: Number, required: true, min: 0, max: 10 },
    param4: { type: Number, required: true, min: 0, max: 10 },
    param5: { type: Number, required: true, min: 0, max: 10 },
    param6: { type: Number, required: true, min: 0, max: 10 },
    param7: { type: Number, required: true, min: 0, max: 10 },
    param8: { type: Number, required: true, min: 0, max: 10 },
    param9: { type: Number, required: true, min: 0, max: 10 },
    param10: { type: Number, required: true, min: 0, max: 10 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Store the last two reports to compare
HealthReportSchema.virtual('previousReports', {
  ref: 'HealthReport',
  localField: 'studentId',
  foreignField: 'studentId',
  options: { limit: 2, sort: { createdAt: -1 } }
});

const HealthReport = mongoose.model('HealthReport', HealthReportSchema);
module.exports = HealthReport;
