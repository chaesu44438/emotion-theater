// emotion-theater-backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { usersContainer } = require("../db");

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET 환경 변수가 설정되지 않았습니다.");
}

// [GET] /api/auth/health - 서버 상태 확인용 엔드포인트
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// [POST] /api/auth/register - 회원가입
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "사용자 이름과 비밀번호를 모두 입력해야 합니다." });
  }

  try {
    // 사용자 이름 중복 확인
    const { resources: existingUsers } = await usersContainer.items
      .query({
        query: "SELECT * from c WHERE c.username = @username",
        parameters: [{ name: "@username", value: username }],
      })
      .fetchAll();

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "이미 사용 중인 사용자 이름입니다." });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = {
      // id: uuidv4(), // Cosmos DB가 자동으로 id 생성
      username,
      hashedPassword,
      role: username === "admin" ? "admin" : "user", // 'admin' 사용자에게 admin 역할 부여
      createdAt: new Date().toISOString(),
    };

    // DB에 사용자 저장
    const { resource: createdUser } = await usersContainer.items.create(newUser);

    res.status(201).json({
      message: "회원가입이 성공적으로 완료되었습니다.",
      userId: createdUser.id,
      username: createdUser.username,
    });
  } catch (error) {
    console.error("회원가입 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// [POST] /api/auth/login - 로그인
router.post("/login", async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "사용자 이름과 비밀번호를 입력하세요." });
  }

  // ✅ [수정] 로그인 시에도 사용자 이름을 소문자로 변환하여 조회합니다.
  const lowerCaseUsername = username.toLowerCase();

  try {
    // ✅ [수정] 소문자로 변환된 사용자 이름으로 사용자를 조회합니다.
    const { resources: users } = await usersContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.username = @username",
        parameters: [{ name: "@username", value: lowerCaseUsername }],
      })
      .fetchAll();

    if (users.length === 0) {
      return res.status(401).json({ message: "사용자 이름 또는 비밀번호가 올바르지 않습니다." });
    }

    const user = users[0];

    // 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "사용자 이름 또는 비밀번호가 올바르지 않습니다." });
    }

    // JWT 생성
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role }, // 토큰에 role 포함
      JWT_SECRET,
      { expiresIn: "7d" } // ✅ [수정] 토큰 유효기간을 7일로 연장
    );

    res.status(200).json({
      message: "로그인 성공",
      token,
      role: user.role,
      username: user.username,
    });
  } catch (error) {
    console.error("로그인 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;
