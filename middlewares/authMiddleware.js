import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const protect = async ( req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false,  error: "Not authorized, token missing.",});
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET );
    const user = await User.findById(  decoded.id).select("-passwordHash -metaAccessToken" );

    if (!user) {
      return res.status(401).json({ success: false, error:  "User no longer exists.",});
    }

    req.user = user;
     next();

  } catch (error) {
    console.error(  "Auth Middleware Error:",  error.message);
    return res.status(401).json({ success: false,  error:  "Not authorized, token invalid or expired.",});
  }
};

export const requireAdmin = ( req,  res, next) => {
  if (  req.user &&  req.user.role === "ADMIN") {
    return next();
  }
  return res.status(403).json({  success: false,  error:  "Access denied: Admin privileges required.", });
};