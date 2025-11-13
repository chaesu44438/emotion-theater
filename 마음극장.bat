@echo off
chcp 65001 > nul
echo "마음극장" 프로젝트 폴더로 이동합니다...
cd /d "%~dp0"
echo "프론트엔드와 백엔드 서버를 동시에 시작합니다."
npm run dev