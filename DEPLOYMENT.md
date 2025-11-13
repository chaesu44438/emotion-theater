# 🚀 Azure App Service 배포 가이드

## 📋 배포 전 체크리스트

- [x] 프론트엔드 파일을 `emotion-theater-backend/public/`로 이동
- [x] 백엔드에 정적 파일 제공 코드 추가
- [x] `.gitignore` 파일 생성
- [x] GitHub Actions workflow 파일 생성
- [ ] Azure App Service 리소스 생성
- [ ] 환경 변수 설정
- [ ] GitHub Secrets 설정
- [ ] Git 저장소 초기화 및 푸시

---

## 🎯 Step 1: Azure App Service 생성

### 1-1. Azure Portal 접속
1. https://portal.azure.com 로그인
2. 상단 검색창: **"App Services"** 입력
3. **"+ Create"** 클릭

### 1-2. 기본 설정
```
Basics 탭:
├─ Subscription: (본인 구독 선택)
├─ Resource Group: 새로 만들기 → "emotion-theater-rg"
├─ Name: emotion-theater (고유한 이름 - 변경 가능)
├─ Publish: Code
├─ Runtime stack: Node 18 LTS
├─ Operating System: Linux (권장)
└─ Region: Korea Central

Pricing Plan:
└─ Basic B1 이상 (동영상 생성 작업을 위해 최소 B1 권장)
```

### 1-3. 생성 완료
- **"Review + create"** → **"Create"** 클릭
- 배포 완료까지 1-2분 대기

---

## ⚙️ Step 2: 환경 변수 설정

### 2-1. App Service 설정 페이지 이동
```
생성한 App Service → Settings → Configuration
```

### 2-2. Application settings 추가
**"+ New application setting"** 클릭하여 아래 환경 변수들을 하나씩 추가:

```bash
# Azure OpenAI - Chat/Story Generation
AZURE_OPENAI_KEY=<본인의 Azure OpenAI Key>
AZURE_OPENAI_ENDPOINT=<본인의 Azure OpenAI Endpoint>
AZURE_OPENAI_DEPLOYMENT_CHAT=<본인의 Chat Deployment 이름>
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Azure OpenAI - DALL-E Image Generation
AZURE_OPENAI_DALLE_KEY=<본인의 DALL-E Key>
AZURE_OPENAI_DALLE_ENDPOINT=<본인의 DALL-E Endpoint>
AZURE_OPENAI_DEPLOYMENT_IMAGE=dall-e-3
AZURE_OPENAI_DALLE_API_VERSION=2024-02-01

# Cosmos DB
COSMOS_ENDPOINT=<본인의 Cosmos DB Endpoint>
COSMOS_KEY=<본인의 Cosmos DB Key>
COSMOS_DATABASE_ID=EmotionTheaterDB
COSMOS_USERS_CONTAINER_ID=Users

# Azure Speech Service (TTS)
AZURE_SPEECH_KEY=<본인의 Azure Speech Key>
AZURE_SPEECH_REGION=<본인의 Speech Region>

# JWT Secret
JWT_SECRET=<본인의 JWT Secret - 랜덤한 문자열>

# Node Environment
NODE_ENV=production

# Port (선택사항, Azure가 자동으로 설정하므로 생략 가능)
# PORT=8080
```

### 2-3. 저장
- 모든 설정 추가 후 **"Save"** 클릭
- 앱이 자동으로 재시작됩니다

---

## 🔐 Step 3: GitHub Secrets 설정

### 3-1. Publish Profile 다운로드
```
App Service → Overview → "Get publish profile" 클릭
→ XML 파일 다운로드됨
```

### 3-2. GitHub 저장소에서 Secrets 추가
1. GitHub 저장소 페이지 이동
2. **Settings** → **Secrets and variables** → **Actions**
3. **"New repository secret"** 클릭
4. Secret 추가:
   ```
   Name: AZURE_WEBAPP_PUBLISH_PROFILE
   Value: (다운로드한 XML 파일의 전체 내용을 복사하여 붙여넣기)
   ```

---

## 📦 Step 4: Git 저장소 초기화 및 푸시

### 4-1. Git 저장소 초기화 (아직 안 했다면)
```bash
git init
git add .
git commit -m "Initial commit: Emotion Theater project"
```

### 4-2. GitHub 원격 저장소 생성
1. https://github.com 접속
2. **"New repository"** 클릭
3. Repository 이름: **emotion-theater**
4. Public 또는 Private 선택
5. **"Create repository"** 클릭

### 4-3. 원격 저장소 연결 및 푸시
```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/emotion-theater.git
git push -u origin main
```

> ⚠️ **YOUR-USERNAME**을 본인의 GitHub 사용자 이름으로 변경하세요!

---

## 🎉 Step 5: 자동 배포 확인

### 5-1. GitHub Actions 실행 확인
```
GitHub 저장소 → Actions 탭
→ "Deploy to Azure App Service" workflow 실행 중인지 확인
```

### 5-2. 배포 진행 상황
- ✅ Checkout code
- ✅ Set up Node.js
- ✅ Install backend dependencies
- ✅ Clean up
- ✅ Deploy to Azure Web App
- ✅ Deployment completed

### 5-3. 앱 접속 테스트
배포 완료 후 다음 URL로 접속:
```
https://emotion-theater.azurewebsites.net
```

### 5-4. API 테스트
```bash
# Health check
curl https://emotion-theater.azurewebsites.net/api/auth/health

# 예상 응답: "OK" 또는 서버 정보
```

---

## 🔧 트러블슈팅

### 문제 1: 배포는 성공했는데 앱이 안 열려요
**해결 방법:**
1. Azure Portal → App Service → Log stream 확인
2. 환경 변수가 제대로 설정되었는지 확인
3. `npm start`가 제대로 실행되는지 로그 확인

### 문제 2: API는 되는데 프론트엔드가 안 보여요
**해결 방법:**
1. `emotion-theater-backend/public/` 폴더에 파일들이 있는지 확인
2. `index.js`에 정적 파일 제공 코드가 있는지 확인

### 문제 3: GitHub Actions가 실패해요
**해결 방법:**
1. GitHub Secrets에 `AZURE_WEBAPP_PUBLISH_PROFILE`이 제대로 설정되었는지 확인
2. Workflow 파일의 `AZURE_WEBAPP_NAME`이 실제 App Service 이름과 일치하는지 확인

### 문제 4: 환경 변수가 적용 안 돼요
**해결 방법:**
1. Azure Portal → Configuration에서 모든 환경 변수 확인
2. 저장 후 앱 재시작: **Restart** 버튼 클릭

---

## 📊 모니터링

### Application Insights 설정 (권장)
```
App Service → Monitoring → Application Insights
→ Enable
→ 앱 성능 및 오류 추적
```

### 로그 확인
```
App Service → Monitoring → Log stream
실시간 로그 확인 가능
```

---

## 🔄 업데이트 배포 방법

코드 수정 후:
```bash
git add .
git commit -m "Update: 설명"
git push origin main
```

→ 자동으로 GitHub Actions 실행되어 Azure에 재배포됨 🚀

---

## 💰 비용 관리

### 예상 비용 (월간)
```
- App Service (B1): ~$13
- Cosmos DB (1000 RU/s): ~$65
- Azure OpenAI: 사용량 기반
- Azure Speech: 사용량 기반
- Storage (videos): 용량 기반

총 예상: $100~$200/월
```

### 비용 절감 팁
1. 사용하지 않을 때 App Service 중지
2. videos 폴더 정기 정리 (보관 기간 설정)
3. Cosmos DB RU/s 최적화
4. Application Insights 데이터 보존 기간 단축

---

## 📞 지원

문제가 있으신가요?
- Azure 지원: https://portal.azure.com → Support
- GitHub Issues: 저장소의 Issues 탭에 문의

---

## ✅ 완료!

축하합니다! 🎉
Emotion Theater가 Azure에 성공적으로 배포되었습니다.

이제 전 세계 어디서나 접속 가능합니다:
**https://emotion-theater.azurewebsites.net**
