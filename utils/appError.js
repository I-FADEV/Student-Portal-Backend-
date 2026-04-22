class AppError extends Error {
  constructor(message, status) {
    super(message); // calls the normal Error constructor
    this.status = status; // adds the status property
  }
}

module.exports = AppError;
