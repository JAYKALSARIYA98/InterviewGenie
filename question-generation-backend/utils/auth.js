import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export function authenticateMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
