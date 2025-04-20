import jwt from 'jsonwebtoken'
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.log(error,'from verify token')
    throw error; // Let the caller handle the error
  }
};

export default verifyToken