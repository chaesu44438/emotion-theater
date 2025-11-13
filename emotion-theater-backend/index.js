const express = require('express');
const cors = require('cors');
const path = require('path'); // ✅ [추가] 정적 파일 제공을 위한 path 모듈
require('dotenv').config(); // .env 파일 로드
const { initializeDatabase } = require('./db'); // ✅ db.js에서 초기화 함수 가져오기

// 라우터 파일들을 가져옵니다.
const authRouter = require('./routes/auth');
const storiesRouter = require('./routes/stories'); // ✅ stories.js 라우터 가져오기
const adminRouter = require('./routes/admin');
const ttsRouter = require('./routes/azureTts');
const videoRouter = require('./routes/video'); // ✅ video.js 라우터 가져오기
const translationRouter = require('./routes/translation');
// ✅ [수정] 올바른 파일 경로('./middleware.js')에서 'authenticateToken' 함수를 가져옵니다.
const { authenticateToken: authMiddleware } = require('./middleware.js'); // 인증 미들웨어

const app = express();

// 미들웨어 설정
app.use(cors());
// ✅ [수정] JSON 요청 본문의 크기 제한을 10MB로 늘립니다. (이미지 데이터 전송을 위함)
app.use(express.json({ limit: '10mb' }));

// ✅ [추가] 전역 예외 처리기: 예상치 못한 오류로 서버가 죽는 것을 방지합니다.
process.on('uncaughtException', (err) => {
  console.error('🚨 [치명적 오류] 처리되지 않은 예외 발생:', err);
  // 프로덕션 환경에서는 여기서 프로세스를 재시작하는 로직을 추가할 수 있습니다.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [치명적 오류] 처리되지 않은 Promise 거부 발생:', reason);
  // 프로덕션 환경에서는 여기서 프로세스를 재시작하는 로직을 추가할 수 있습니다.
});


// --- 라우터 등록 ---
// '/api/auth' 경로로 들어오는 요청은 authRouter가 처리합니다.
app.use('/api/auth', authRouter);

// ✅ [추가] '/api/stories' 경로로 들어오는 요청은 storiesRouter가 처리합니다.
// 이 코드가 추가되어야 /api/stories/regenerate-prompt 등의 주소가 동작합니다.
app.use('/api/stories', authMiddleware, storiesRouter);

// '/api/admin' 경로로 들어오는 요청은 adminRouter가 처리합니다. (관리자 전용)
app.use('/api/admin', authMiddleware, (req, res, next) => {
  // 간단한 역할 기반 접근 제어
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '접근 권한이 없습니다.' });
  }
  next();
}, adminRouter);

// '/api/tts' 경로로 들어오는 요청은 ttsRouter가 처리합니다.
app.use('/api/tts', authMiddleware, ttsRouter);

app.use('/api/translate', authMiddleware, translationRouter);

// ✅ [수정] '/api/video' 경로의 라우팅을 분리합니다.
// 다운로드 경로는 인증 없이 접근할 수 있도록 하고, 그 외의 경로(생성 등)는 인증을 거치도록 합니다.
app.use('/api/video', (req, res, next) => {
  if (req.path.startsWith('/download/')) return videoRouter(req, res, next); // 다운로드 경로는 인증 미들웨어를 건너뛰고 바로 videoRouter로 연결합니다.
  return authMiddleware(req, res, () => videoRouter(req, res, next)); // 그 외 경로는 인증을 수행한 후 videoRouter로 연결합니다.
});

// ✅ [추가] 프론트엔드 정적 파일 제공 (배포용)
// public 폴더의 정적 파일들을 제공합니다 (HTML, CSS, JS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ [추가] SPA (Single Page Application) 지원
// API 경로가 아닌 모든 요청은 index.html로 리다이렉트
app.get('*', (req, res) => {
  // API 경로는 제외
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ✅ [수정] 데이터베이스 초기화가 완료된 후 서버를 시작합니다.
initializeDatabase()
  .then(() => {
    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 서버가 ${PORT}번 포트에서 실행 중입니다.`);
    });

    // ✅ [추가] 긴 요청을 위한 타임아웃 설정 (5분)
    server.timeout = 300000; // 300초 = 5분
    server.keepAliveTimeout = 65000; // 65초
    server.headersTimeout = 66000; // 66초

    console.log(`⏱️  서버 타임아웃: ${server.timeout}ms`);
  })
  .catch(error => {
    console.error("❌ 데이터베이스 초기화 실패, 서버를 시작할 수 없습니다:", error);
    process.exit(1); // 초기화 실패 시 프로세스 종료
  });

module.exports = app;