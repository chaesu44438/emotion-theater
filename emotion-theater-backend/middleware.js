const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  // ✅ [수정] 1. 헤더에서 토큰을 먼저 찾아봅니다.
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" 형식

  // ✅ [수정] 2. 헤더에 토큰이 없으면, 쿼리 파라미터에서 찾아봅니다.
  if (token == null && req.query.token) token = req.query.token;

  if (token == null) {
    return res.sendStatus(401); // 토큰 없음
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // 토큰이 유효하지 않음 (만료 등)
    }
    req.user = user; // 요청 객체에 사용자 정보(payload) 저장
    next();
  });
}

function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '접근 권한이 없습니다. 관리자만 사용할 수 있습니다.' });
    }
    next();
  });
}


module.exports = { authenticateToken, authenticateAdmin };