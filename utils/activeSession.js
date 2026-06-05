const Session = require("../models/session.model");
const AppError = require("./appError");

// Get active session and map phase to semester
const getActiveSession = async () => {
  const activeSession = await Session.findOne({ status: "active" });
  
  if (!activeSession) {
    throw new AppError("No active session found. Please create and start a session first.", 400);
  }

  // Map phase to semester
  const phaseToSemester = {
    first: "First",
    second: "Second",
    summer: "Summer",
  };

  return {
    session: activeSession.session,
    semester: phaseToSemester[activeSession.phase] || "First",
    phase: activeSession.phase,
  };
};

module.exports = { getActiveSession };
