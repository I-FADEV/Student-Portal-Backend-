const logAction = require("../utils/logAction");
const IdCard = require("../models/idCard.model");

const studentIdCard = async ({
  nameOnCard,
  nationalityOnCard,
  dobOnCard,
  departmentOnCard,
  sessionOnCard,
  genderOnCard,
  levelOnCard,
  matricOnCard,
  telOnCard,
  user,
  file,
  studentId,
  fileName,
}) => {
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!file) {
    throw new Error("Please upload an image file");
  }

  const normalizedName = nameOnCard.toUpperCase();
  const normalizedNationality = nationalityOnCard.toUpperCase();
  const normalizedDepartment = departmentOnCard.toUpperCase();
  const normalizedMatric = matricOnCard.toUpperCase();

  // prevent duplicate ID card
  const existing = await IdCard.findOne({ student: studentId });
  if (existing) {
    throw new Error("ID card already exists");
  }

  // check if student has already paid for ID Card in their finance record
  const financeRecord = await Finance.findOne({
    student: studentId,
    session: sessionOnCard,
  });

  let paidStatus = "Unpaid"; // default

  if (financeRecord) {
    const idCardItem = financeRecord.items.find((i) => i.label === "ID Card");
    if (idCardItem && idCardItem.status === "Paid") {
      paidStatus = "Paid"; // they already paid, reflect that
    }
  }

  // build the URL path to the saved file
  const photoURLPath = `/uploads/${fileName}`;

  const idcard = await IdCard.create({
    student: studentId,
    photoURL: photoURLPath,
    nameOnCard: normalizedName,
    nationalityOnCard: normalizedNationality,
    dobOnCard,
    departmentOnCard: normalizedDepartment,
    sessionOnCard,
    genderOnCard,
    levelOnCard,
    matricOnCard: normalizedMatric,
    telOnCard,
  });

  // await logAction({});

  return { data: idcard };
};

const viewStudentIdCard = async ({ session, studentId }) => {
  const idCard = await IdCard.findOne({
    student: studentId,
    sessionOnCard: session,
  });

  if (!idCard) {
    throw new Error("ID card not found for this student and session");
  }

  return { data: idCard };
};

module.exports = { studentIdCard, viewStudentIdCard };
