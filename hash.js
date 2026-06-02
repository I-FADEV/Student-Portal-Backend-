const bcrypt = require("bcryptjs");

const password = "Gadmin2026"; // 👈 change this if needed (e.g. "Gadmin2026")

(async () => {
  const hash = await bcrypt.hash(password, 10);
  console.log("HASH:", hash);
})();