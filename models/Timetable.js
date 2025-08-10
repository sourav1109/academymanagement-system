const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const periodSchema = new Schema({
  periodNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  subject: {
    type: String,
    required: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
});

const daySchema = new Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  periods: [periodSchema]
});

const timetableSchema = new Schema({
  class: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  section: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'E']
  },
  academicYear: {
    type: String,
    required: true
  },
  days: [daySchema],
  // Track teacher's daily class count
  teacherDailyClasses: [{
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    classCount: {
      type: Number,
      default: 0
    }
  }],
  firstPeriodTeacher: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure unique combination of class, section, and academic year
timetableSchema.index({ class: 1, section: 1, academicYear: 1 }, { unique: true });

// Method to check if a teacher can be assigned to a period
timetableSchema.methods.canAssignTeacher = function(teacherId, day, periodNumber) {
  // Check if teacher already has 4 classes that day
  const teacherDayCount = this.teacherDailyClasses.find(t => 
    t.teacher.toString() === teacherId.toString() && 
    t.day === day
  );

  if (teacherDayCount && teacherDayCount.classCount >= 4) {
    return false;
  }

  // Check for consecutive classes
  const daySchedule = this.days.find(d => d.day === day);
  if (daySchedule) {
    const periods = daySchedule.periods;
    // Check previous period
    if (periodNumber > 1) {
      const prevPeriod = periods.find(p => p.periodNumber === periodNumber - 1);
      if (prevPeriod && prevPeriod.teacher.toString() === teacherId.toString()) {
        return false;
      }
    }
    // Check next period
    if (periodNumber < 8) {
      const nextPeriod = periods.find(p => p.periodNumber === periodNumber + 1);
      if (nextPeriod && nextPeriod.teacher.toString() === teacherId.toString()) {
        return false;
      }
    }
  }

  return true;
};

// Method to check if a teacher is assigned to a specific class and day
timetableSchema.methods.isTeacherAssigned = function(teacherId, day) {
  const daySchedule = this.days.find(d => d.day === day);
  if (!daySchedule) return false;
  
  return daySchedule.periods.some(p => p.teacher.toString() === teacherId.toString());
};

const Timetable = mongoose.model('Timetable', timetableSchema);
module.exports = Timetable; 