const logAction = require("../utils/logAction");
const IdCard = require("../models/idCard.model");

const studentIdCard = async ({
  nameOnCard,
  matricOnCard,
  departmentOnCard,
  levelOnCard,
  sessionOnCard,
  user,
  file,
  userId,
  fileName,
}) => {
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!file) {
    throw new Error("Please upload an image file");
  }

  const normalizedName = nameOnCard.toUpperCase();
  const normalizedNumber = matricOnCard.toUpperCase();
  const normalizedDepartment = departmentOnCard.toUpperCase();

  // prevent duplicate ID card
  const existing = await IdCard.findOne({ student: userId });
  if (existing) {
    throw new Error("ID card already exists");
  }

  // build the URL path to the saved file
  const photoURLPath = `/uploads/${fileName}`;

  const idcard = await IdCard.create({
    student: userId,
    photoURL: photoURLPath,
    nameOnCard: normalizedName,
    matricOnCard: normalizedNumber,
    departmentOnCard: normalizedDepartment,
    levelOnCard,
    sessionOnCard,
  });

  // await logAction({});

  return { data: idcard };
};

module.exports = { studentIdCard };
