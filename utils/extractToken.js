const extractToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.jwt) {
    return req.cookies.jwt;
  }
  return null;
};


export default extractToken