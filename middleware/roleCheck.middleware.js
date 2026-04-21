const roleCheck =
  (roles = [], adminTypes = []) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // check the role first
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // if specific adminTypes are required, check that too
    if (adminTypes.length > 0 && !adminTypes.includes(req.user.adminType)) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };

module.exports = roleCheck;
