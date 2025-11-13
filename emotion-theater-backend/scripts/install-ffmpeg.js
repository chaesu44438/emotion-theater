#!/usr/bin/env node

/**
 * Azure 배포 후 ffmpeg 자동 설치 스크립트
 * - Windows 환경: 건너뜀 (이미 bin/ffmpeg.exe 존재)
 * - Linux/Azure 환경: ffmpeg 정적 바이너리 다운로드
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined;
const binDir = path.join(__dirname, '..', 'bin');

console.log('========================================');
console.log('🔧 ffmpeg 설치 스크립트');
console.log('========================================');
console.log(`플랫폼: ${process.platform}`);
console.log(`Azure 환경: ${isAzure ? '예' : '아니오'}`);

// Windows 환경이면 건너뜀
if (isWindows) {
  console.log('✅ Windows 환경 - ffmpeg 설치 건너뜀');
  console.log('========================================');
  process.exit(0);
}

// Linux 환경 - ffmpeg 설치
console.log('🐧 Linux 환경 - ffmpeg 설치 시작');

try {
  // bin 디렉토리 생성
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
    console.log(`📁 디렉토리 생성: ${binDir}`);
  }

  // 이미 설치되어 있는지 확인
  const ffmpegPath = path.join(binDir, 'ffmpeg');
  const ffprobePath = path.join(binDir, 'ffprobe');

  if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
    console.log('✅ ffmpeg가 이미 설치되어 있습니다.');
    console.log('========================================');
    process.exit(0);
  }

  console.log('📥 ffmpeg 정적 바이너리 다운로드 중...');

  // 임시 디렉토리에서 작업
  const tempDir = path.join(binDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  process.chdir(tempDir);

  // ffmpeg 다운로드 (타임아웃 60초)
  console.log('⏬ 다운로드 시작...');
  execSync('wget -q --timeout=60 https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz', {
    stdio: 'inherit',
    timeout: 90000 // 90초
  });

  console.log('📦 압축 해제 중...');
  execSync('tar -xf ffmpeg-release-amd64-static.tar.xz', {
    stdio: 'inherit'
  });

  // ffmpeg와 ffprobe 파일 찾기 및 복사
  const files = fs.readdirSync(tempDir);
  const ffmpegDir = files.find(f => f.startsWith('ffmpeg-') && f.includes('-static'));

  if (!ffmpegDir) {
    throw new Error('ffmpeg 디렉토리를 찾을 수 없습니다.');
  }

  const sourceFfmpeg = path.join(tempDir, ffmpegDir, 'ffmpeg');
  const sourceFfprobe = path.join(tempDir, ffmpegDir, 'ffprobe');

  console.log('📋 파일 복사 중...');
  fs.copyFileSync(sourceFfmpeg, ffmpegPath);
  fs.copyFileSync(sourceFfprobe, ffprobePath);

  // 실행 권한 부여
  fs.chmodSync(ffmpegPath, 0o755);
  fs.chmodSync(ffprobePath, 0o755);

  // 임시 파일 정리
  console.log('🧹 임시 파일 정리 중...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('✅ ffmpeg 설치 완료!');

  // 버전 확인
  try {
    const version = execSync(`${ffmpegPath} -version`, { encoding: 'utf8' });
    console.log('📌 설치된 버전:');
    console.log(version.split('\n')[0]);
  } catch (e) {
    console.log('⚠️  버전 확인 실패 (정상 동작할 수 있음)');
  }

  console.log('========================================');
  process.exit(0);

} catch (error) {
  console.error('❌ ffmpeg 설치 실패:', error.message);
  console.log('⚠️  서버는 시작되지만 동영상 생성이 작동하지 않을 수 있습니다.');
  console.log('========================================');

  // 실패해도 배포는 계속 진행
  process.exit(0);
}
