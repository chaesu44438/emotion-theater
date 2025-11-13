# 마음극장 (Emotion Theater) - 설치 가이드

## 📋 목차
1. [시스템 요구사항](#시스템-요구사항)
2. [FFmpeg 설치](#ffmpeg-설치)
3. [프로젝트 설정](#프로젝트-설정)
4. [환경 변수 설정](#환경-변수-설정)
5. [실행 방법](#실행-방법)

---

## 시스템 요구사항

- **Node.js**: v18 이상
- **npm**: v9 이상
- **FFmpeg**: 최신 버전
- **운영체제**: Windows 10/11

---

## FFmpeg 설치

FFmpeg은 동영상 생성 기능에 필수적입니다.

### Windows 설치 방법

#### 방법 1: Chocolatey 사용 (권장)

1. **Chocolatey 설치** (아직 없다면)
   - PowerShell을 **관리자 권한**으로 실행
   - 다음 명령어 실행:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **FFmpeg 설치**
   ```powershell
   choco install ffmpeg
   ```

3. **설치 확인**
   ```bash
   ffmpeg -version
   ```

#### 방법 2: 수동 설치

1. **FFmpeg 다운로드**
   - 공식 사이트 접속: https://www.gyan.dev/ffmpeg/builds/
   - **"ffmpeg-release-essentials.zip"** 다운로드

2. **압축 해제**
   - 다운로드한 zip 파일을 `C:\ffmpeg`에 압축 해제
   - 최종 경로: `C:\ffmpeg\bin\ffmpeg.exe`

3. **환경 변수 설정**
   - `Win + R` → `sysdm.cpl` 입력 → Enter
   - **고급** 탭 → **환경 변수** 클릭
   - **시스템 변수**에서 `Path` 선택 → **편집**
   - **새로 만들기** → `C:\ffmpeg\bin` 입력
   - **확인**을 눌러 모든 창 닫기

4. **설치 확인**
   - 새 명령 프롬프트 창을 열고 실행:
   ```bash
   ffmpeg -version
   ```
   - 버전 정보가 나오면 설치 성공!

---

## 프로젝트 설정

### 1. 프로젝트 복사

```bash
cd C:\Users\user\Desktop
git clone [프로젝트 주소]
cd story2
```

### 2. 백엔드 의존성 설치

```bash
cd emotion-theater-backend
npm install
```

필요한 패키지:
- `express`: 웹 서버
- `@azure/cosmos`: Azure Cosmos DB
- `openai`: Azure OpenAI API
- `microsoft-cognitiveservices-speech-sdk`: Azure TTS
- `fluent-ffmpeg`: FFmpeg 제어
- `axios`: HTTP 클라이언트
- `bcrypt`: 비밀번호 암호화
- `jsonwebtoken`: JWT 인증
- `dotenv`: 환경 변수 관리

---

## 환경 변수 설정

백엔드 폴더에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Azure Cosmos DB
COSMOS_ENDPOINT=your_cosmos_endpoint
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE_NAME=EmotionTheaterDB

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=your_openai_endpoint
AZURE_OPENAI_KEY=your_openai_key
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_CHAT=gpt-4
AZURE_OPENAI_DEPLOYMENT_IMAGE=dall-e-3

# Azure Speech (TTS)
AZURE_SPEECH_KEY=your_speech_key
AZURE_SPEECH_REGION=your_speech_region

# JWT Secret
JWT_SECRET=your_random_secret_key_here

# Server Port
PORT=4000
```

### Azure 서비스 설정 방법

1. **Azure Portal** (https://portal.azure.com) 접속

2. **Azure Cosmos DB 생성**
   - "Cosmos DB 계정 만들기" 선택
   - API: Core (SQL) 선택
   - 계정 이름, 리소스 그룹 설정
   - 생성 후 "키" 메뉴에서 `COSMOS_ENDPOINT`와 `COSMOS_KEY` 복사

3. **Azure OpenAI 생성**
   - "Azure OpenAI 리소스 만들기" 선택
   - 모델 배포: GPT-4, DALL-E-3
   - "키 및 엔드포인트"에서 정보 복사

4. **Azure Speech 서비스 생성**
   - "Speech Services 만들기" 선택
   - "키 및 엔드포인트"에서 정보 복사

---

## 실행 방법

### 1. 백엔드 서버 시작

```bash
cd emotion-theater-backend
npm start
```

서버가 `http://localhost:4000`에서 실행됩니다.

### 2. 프론트엔드 실행

새 터미널을 열고:

```bash
cd story2
npx live-server --port=5500 --proxy=/api:http://localhost:4000
```

브라우저에서 `http://127.0.0.1:5500` 접속

---

## 주요 기능

### 1. 동화 생성
- 이름, 감정, 코멘트를 입력하여 맞춤형 동화 생성
- Azure OpenAI GPT-4를 사용한 동화 생성
- Pollinations.ai를 사용한 삽화 생성

### 2. TTS (Text-to-Speech)
- Azure Speech Services를 사용한 음성 생성
- 한국어 여성 음성 (ko-KR-SunHiNeural)

### 3. 동영상 생성
- FFmpeg을 사용한 동영상 제작
- 4개 장면으로 구성
- 각 장면마다 이미지 + TTS 결합
- 약 2-5분 소요

### 4. 사용자 관리
- JWT 기반 인증
- 회원가입/로그인
- 동화 보관함

---

## 문제 해결

### FFmpeg 오류

**오류**: `ffmpeg: command not found`

**해결 방법**:
1. FFmpeg이 올바르게 설치되었는지 확인
2. 환경 변수 Path에 FFmpeg bin 폴더가 추가되었는지 확인
3. 명령 프롬프트/PowerShell을 재시작

### 백엔드 연결 오류

**오류**: `ECONNRESET`, `Failed to fetch`

**해결 방법**:
1. 백엔드 서버가 실행 중인지 확인 (`http://localhost:4000`)
2. `.env` 파일이 올바르게 설정되었는지 확인
3. 방화벽이 포트 4000을 차단하지 않는지 확인

### Azure 서비스 오류

**오류**: `401 Unauthorized`, `403 Forbidden`

**해결 방법**:
1. `.env` 파일의 Azure 키가 올바른지 확인
2. Azure Portal에서 서비스가 활성화되었는지 확인
3. 배포된 모델 이름이 `.env`의 설정과 일치하는지 확인

### 동영상 생성 오류

**오류**: `Image download failed`, `Request failed with status code 500`

**해결 방법**:
1. 인터넷 연결 확인
2. Pollinations.ai 서비스 상태 확인
3. 재시도 (서비스가 일시적으로 불안정할 수 있음)

---

## 프로젝트 구조

```
story2/
├── emotion-theater-backend/     # 백엔드 (Node.js + Express)
│   ├── routes/
│   │   ├── auth.js             # 인증 API
│   │   ├── stories.js          # 동화 API
│   │   ├── admin.js            # 관리자 API
│   │   ├── tts.js              # TTS API
│   │   └── video.js            # 동영상 생성 API
│   ├── db.js                   # Cosmos DB 연결
│   ├── index.js                # 서버 진입점
│   ├── package.json            # 의존성 목록
│   └── .env                    # 환경 변수 (직접 생성)
│
├── components/
│   └── EmotionTheater.js       # 메인 React 컴포넌트
│
├── libs/
│   ├── apiService.js           # API 호출 라이브러리
│   ├── storage.js              # 로컬 스토리지 관리
│   └── emotions.js             # 감정 데이터
│
├── index.html                  # 프론트엔드 진입점
├── style.css                   # 스타일시트
└── SETUP.md                    # 이 파일
```

---

## 라이선스

이 프로젝트는 교육 및 개인 사용 목적으로 제공됩니다.

---

## 문의

문제가 발생하거나 질문이 있으시면 이슈를 등록해주세요.
