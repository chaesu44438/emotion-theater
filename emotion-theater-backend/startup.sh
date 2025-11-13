#!/bin/bash

# Azure App Service Linux 시작 스크립트
echo "========================================="
echo "Emotion Theater 시작 스크립트 실행 중..."
echo "========================================="

# ffmpeg 설치 확인
if ! command -v ffmpeg &> /dev/null
then
    echo "[설치] ffmpeg가 설치되어 있지 않습니다. 설치를 시작합니다..."

    # Oryx 환경의 경우 apt-get이 제한될 수 있으므로 정적 바이너리 다운로드
    echo "[설치] ffmpeg 정적 바이너리 다운로드 중..."

    # /home 디렉토리에 ffmpeg 설치 (Azure에서 지속 가능한 디렉토리)
    mkdir -p /home/ffmpeg
    cd /home/ffmpeg

    # ffmpeg 정적 빌드 다운로드 (Linux x64)
    wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

    if [ $? -eq 0 ]; then
        echo "[설치] ffmpeg 압축 해제 중..."
        tar -xf ffmpeg-release-amd64-static.tar.xz

        # ffmpeg와 ffprobe를 PATH에 추가
        FFMPEG_DIR=$(find /home/ffmpeg -type d -name "ffmpeg-*-static" | head -n 1)

        if [ -d "$FFMPEG_DIR" ]; then
            export PATH="$FFMPEG_DIR:$PATH"
            echo "[설치] ffmpeg 설치 완료!"
            echo "[설치] ffmpeg 경로: $FFMPEG_DIR"

            # 심볼릭 링크 생성
            ln -sf "$FFMPEG_DIR/ffmpeg" /usr/local/bin/ffmpeg
            ln -sf "$FFMPEG_DIR/ffprobe" /usr/local/bin/ffprobe

            ffmpeg -version
        else
            echo "[오류] ffmpeg 디렉토리를 찾을 수 없습니다."
        fi
    else
        echo "[오류] ffmpeg 다운로드 실패!"
    fi
else
    echo "[확인] ffmpeg가 이미 설치되어 있습니다."
    ffmpeg -version
fi

echo "========================================="
echo "시작 스크립트 완료. Node.js 앱 시작..."
echo "========================================="

# Node.js 앱 시작
cd /home/site/wwwroot
npm start
