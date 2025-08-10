const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PerformanceReportSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  term: { type: String, required: true, enum: ['First Term', 'Second Term', 'Final Term'] },
  academicPerformance: {
    subjects: [{
      subjectName: { type: String, required: true },
      marks: { type: Number, required: true },
      grade: { type: String, required: true },
      remarks: { type: String }
    }],
    totalMarks: { type: Number, required: true },
    average: { type: Number, required: true },
    rank: { type: Number }
  },
  behavioralPerformance: {
    attendance: { type: Number, required: true },
    punctuality: { type: Number, required: true, min: 1, max: 5 },
    discipline: { type: Number, required: true, min: 1, max: 5 },
    participation: { type: Number, required: true, min: 1, max: 5 },
    teamwork: { type: Number, required: true, min: 1, max: 5 }
  },
  teacherRemarks: { type: String },
  parentRemarks: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Store the last two reports to compare
PerformanceReportSchema.virtual('previousReports', {
  ref: 'PerformanceReport',
  localField: 'studentId',
  foreignField: 'studentId',
  options: { limit: 2, sort: { createdAt: -1 } }
});

const PerformanceReport = mongoose.model('PerformanceReport', PerformanceReportSchema);
module.exports = PerformanceReport;
