const express = require("express");
const router = express.Router();
const { AzureOpenAI } = require("openai");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

// ✅ [수정] 환경에 따라 ffmpeg 경로 설정
// Windows 로컬 환경: 프로젝트 내부의 ffmpeg.exe 사용
// Azure Linux 환경: 시스템에 설치된 ffmpeg 사용
const isWindows = process.platform === 'win32';
const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined; // Azure 환경 감지

if (isWindows && !isAzure) {
  // Windows 로컬 개발 환경
  const ffmpegPath = path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
  const ffprobePath = path.join(__dirname, '..', 'bin', 'ffprobe.exe');
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  console.log('[Video] Windows 환경: 로컬 ffmpeg.exe 사용');
} else {
  // Azure Linux 환경 또는 기타 Unix 환경: 시스템 ffmpeg 사용
  console.log('[Video] Linux/Azure 환경: 시스템 ffmpeg 사용');
}

const {
  storiesContainer,
  settingsContainer,
  DEFAULT_IMAGE_PROMPT_SYSTEM,
} = require("../db");

// ✅ [수정] 텍스트 생성용(GPT) OpenAI 클라이언트 초기화
const textClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  timeout: 180000,
});

// ✅ [수정] 이미지 생성용(DALL-E) OpenAI 클라이언트 초기화
const dalleClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_DALLE_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_DALLE_KEY,
  apiVersion: process.env.AZURE_OPENAI_DALLE_API_VERSION,
  timeout: 180000,
});

// 임시 파일 저장 디렉토리
const TEMP_DIR = path.join(__dirname, "../temp");
const VIDEOS_DIR = path.join(__dirname, "../videos");

// 디렉토리 생성
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

// 이미지 다운로드 함수 (재시도 로직 포함)
async function downloadImage(url, filepath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        timeout: 30000, // 30초 타임아웃
      });
      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    } catch (error) {
      console.log(`[VIDEO] 이미지 다운로드 시도 ${attempt}/${retries} 실패: ${error.message}`);
      if (attempt === retries) {
        throw error; // 마지막 재시도 실패 시 에러 발생
      }
      // 재시도 전 2초 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// ✅ XML 특수문자 이스케이프 함수
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ✅ [추가] 감정 표현을 위한 SSML 태그 추가 함수
function addEmotionToText(text) {
  // 먼저 텍스트를 안전하게 이스케이프
  const escapedText = escapeXml(text);

  let processedText = escapedText;

  // 감탄사 패턴 (와!, 어머!, 앗!, 헉!, 오!, 우와! 등)
  const exclamations = /(와|우와|어머|앗|헉|오|아|야|이런|대단해|멋져|좋아|신나|최고)(!+)/gi;

  // 느낌표로 끝나는 문장 (강조)
  const exclamationSentence = /([^<>\n]+!+)/g;

  // 물음표로 끝나는 문장 (의문)
  const questionSentence = /([^<>\n]+\?+)/g;

  // 말줄임표 (느리게)
  const ellipsis = /(\.\.\.+|…)/g;

  // 1. 감탄사에 강한 감정 추가
  processedText = processedText.replace(exclamations, (match) => {
    return `<emphasis level="strong"><prosody pitch="+15%" rate="1.1">${match}</prosody></emphasis>`;
  });

  // 2. 느낌표 문장에 활기찬 톤 추가 (감탄사 제외)
  processedText = processedText.replace(exclamationSentence, (match) => {
    // 이미 처리된 emphasis 태그가 있으면 건너뜀
    if (match.includes('emphasis') || match.includes('prosody')) return match;
    return `<prosody pitch="+8%" rate="1.05">${match}</prosody>`;
  });

  // 3. 물음표 문장에 의문 톤 추가
  processedText = processedText.replace(questionSentence, (match) => {
    // 이미 처리된 태그가 있으면 건너뜀
    if (match.includes('prosody')) return match;
    return `<prosody pitch="+5%">${match}</prosody>`;
  });

  // 4. 말줄임표에 느린 속도 추가
  processedText = processedText.replace(ellipsis, (match) => {
    return `<break time="300ms"/><prosody rate="0.85">${match}</prosody><break time="300ms"/>`;
  });

  return processedText;
}

// ✅ [수정] 화자별 음성을 다르게 적용하여 SSML 기반 TTS 생성
// 화자 이름(나레이터:, 엄마:, 아빠: 등)은 읽지 않고, 대사만 읽습니다.
async function generateSceneTTS(text, characterName, voicePref) {
  const sdk = require("microsoft-cognitiveservices-speech-sdk");
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );

  console.log(`[TTS] generateSceneTTS 호출됨 - voicePref: ${voicePref}, characterName: ${characterName}`);

  // ✅ 화자별 음성 매핑
  const voiceMap = {
    '나레이터': voicePref === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural',
    '엄마': 'ko-KR-SunHiNeural',
    '아빠': 'ko-KR-InJoonNeural',
    '할머니': 'ko-KR-SoonBokNeural',
    '할아버지': 'ko-KR-InJoonNeural',
    // 동물/조연 캐릭터들
    '토끼': 'ko-KR-SeoHyeonNeural', // 밝고 귀여운 목소리
    '다람쥐': 'ko-KR-SeoHyeonNeural',
    '새': 'ko-KR-JiMinNeural',
    '곰': 'ko-KR-BongJinNeural',
    '부엉이': 'ko-KR-InJoonNeural',
    '친구': voicePref === 'male' ? 'ko-KR-GookMinNeural' : 'ko-KR-JiMinNeural',
    '선생님': 'ko-KR-SunHiNeural',
  };

  // ✅ [수정] 텍스트를 화자별로 분리하여 SSML 생성
  const lines = text.split('\n').filter(line => line.trim());
  let ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">';

  for (const line of lines) {
    // "화자: 대사" 형식인지 확인
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const speaker = match[1].trim(); // 화자 이름 (읽지 않음)
      const dialogue = match[2].trim(); // 대사만 추출 (이것만 읽음)

      // 화자에 맞는 음성 선택
      let voice = voiceMap[speaker];
      if (!voice) {
        // 주인공 이름일 가능성
        if (speaker === characterName) {
          voice = voicePref === 'male' ? 'ko-KR-GookMinNeural' : 'ko-KR-JiMinNeural';
        } else {
          // 기본 음성
          voice = voicePref === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
        }
      }

      // ✅ 중요: dialogue만 SSML에 포함 (화자 이름은 제외)
      // ✅ [추가] 감정 표현 추가
      const emotionalDialogue = addEmotionToText(dialogue);
      console.log(`[TTS] 화자: "${speaker}" → 음성: ${voice}, 대사: "${dialogue.substring(0, 30)}..."`);
      ssml += `<voice name="${voice}">${emotionalDialogue}</voice>`;
    } else {
      // 화자 없는 일반 텍스트는 나레이터 음성으로
      const narratorVoice = voicePref === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
      const emotionalLine = addEmotionToText(line);
      console.log(`[TTS] 화자 없음 → 나레이터 음성: ${narratorVoice}, 텍스트: "${line.substring(0, 30)}..."`);
      ssml += `<voice name="${narratorVoice}">${emotionalLine}</voice>`;
    }
  }

  ssml += '</speak>';

  console.log(`[TTS] SSML 생성 완료 (화자 이름 제거됨), voicePref=${voicePref}`);

  return new Promise((resolve, reject) => {
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          synthesizer.close();
          resolve(Buffer.from(result.audioData));
        } else {
          synthesizer.close();
          reject(new Error("TTS failed: " + result.errorDetails));
        }
      },
      (error) => {
        synthesizer.close();
        reject(error);
      }
    );
  });
}

// 이미지 + 오디오를 동영상으로 변환
// ✅ [수정] 오디오 길이에 맞춰 동영상을 생성합니다 (duration 파라미터 제거)
function createVideoFromImageAndAudio(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions('-noautorotate') // ✅ [재확인] 이미지의 자동 회전을 방지합니다.
      .loop() // 이미지를 무한 반복 (-shortest 옵션이 오디오 길이에 맞춰 자름)
      .input(audioPath)
      .outputOptions([
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest", // 오디오 길이에 맞춰 동영상 생성
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

// 여러 동영상을 하나로 결합
function concatenateVideos(videoPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const listFile = path.join(TEMP_DIR, `concat_${Date.now()}.txt`);
    const listContent = videoPaths.map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(listFile, listContent);

    ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .output(outputPath)
      .on("end", () => {
        fs.unlinkSync(listFile);
        resolve();
      })
      .on("error", (err) => {
        if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
        reject(err);
      })
      .run();
  });
}

// ✅ [추가] 동영상 생성 로직을 별도 비동기 함수로 분리
async function processVideoGeneration(story, userData, videoId, tempDir, userToken) { // userToken 인자 추가
  // ✅ [수정] voicePref에 기본값 설정 (undefined 방지)
  const voicePref = userData.voicePref || 'female';

  try {
    console.log("[VIDEO] 동영상 생성 시작:", videoId);
    console.log("[VIDEO] 사용할 음성 설정:", voicePref);

    // ✅ [수정] 1. /api/stories/generate-video-scenes 엔드포인트를 호출하여 장면 데이터를 가져옵니다.
    // 이 호출은 서버 내부에서 이루어집니다.
    console.log("[VIDEO] 장면 분할 및 삽화 프롬프트 생성을 요청합니다...");
    const sceneResponse = await axios.post(
      `http://localhost:${process.env.PORT || 4000}/api/stories/generate-video-scenes`,
      {
        story,
        userData, // ✅ [수정] userData 객체 전체를 전달합니다.
      },
      { // ✅ [수정] Authorization 헤더 추가
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userToken // 클라이언트로부터 받은 토큰을 그대로 전달
        },
        timeout: 300000, // 내부 호출 타임아웃 5분
      }
    );
    const scenes = sceneResponse.data.scenes;
    console.log(`[VIDEO] ${scenes.length}개 장면 데이터 수신 완료`);

    // 2. 각 장면별 처리
    let imagePromptSystem = DEFAULT_IMAGE_PROMPT_SYSTEM;
    try {
      const { resource: imagePromptSetting } = await settingsContainer.item("imagePromptSystem", "prompt").read();
      if (imagePromptSetting) imagePromptSystem = imagePromptSetting.value;
    } catch (e) {
      console.log("[Prompt] DB에 저장된 이미지 프롬프트 설정이 없어 기본값을 사용합니다.");
    }

    const sceneVideos = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`[VIDEO] 장면 ${scene.scene} 처리 중...`);
      console.log(`[VIDEO] 장면 ${scene.scene} 텍스트 내용 (처음 200자):`);
      console.log(scene.text.substring(0, 200));
      console.log('---');

      // ✅ [수정] 2-1. 이미 생성된 삽화 프롬프트를 사용합니다.
      const imagePrompt = scene.imagePrompt || "A beautiful fairy tale scene";
      console.log(`[VIDEO] 장면 ${scene.scene} DALL-E 프롬프트:`, imagePrompt);

      let imageUrl;
      try {
        // ✅ [수정] DALL-E 이미지 생성
        const imageResponse = await dalleClient.images.generate({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE,
          prompt: imagePrompt,
          n: 1,
          size: "1792x1024", // ✅ [수정] 가로 비율(16:9)로 변경하여 회전 문제 방지
          quality: "standard",
        });
        imageUrl = imageResponse.data[0].url;
        console.log(`[VIDEO] 장면 ${scene.scene} DALL-E 이미지 생성 완료`);
      } catch (error) {
        // ✅ [추가] 콘텐츠 정책 위반 오류 발생 시, 안전한 대체 프롬프트로 재시도합니다.
        if (error.code === 'content_policy_violation') {
          console.warn(`[VIDEO] 장면 ${scene.scene}의 프롬프트가 콘텐츠 정책에 위반되어 대체 프롬프트로 재시도합니다.`);
          const safeImagePrompt = "A beautiful and safe illustration for a children's fairy tale, gentle and heartwarming style, simple background.";
          const imageResponse = await dalleClient.images.generate({
            model: process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE,
            prompt: safeImagePrompt,
            n: 1,
            size: "1792x1024", // ✅ [수정] 가로 비율(16:9)로 변경하여 회전 문제 방지
            quality: "standard",
          });
          imageUrl = imageResponse.data[0].url;
          console.log(`[VIDEO] 장면 ${scene.scene} 대체 프롬프트로 DALL-E 이미지 생성 완료`);
        } else {
          throw error; // 다른 종류의 오류는 그대로 전파
        }
      }

      // 2-2. 이미지 다운로드
      const imagePath = path.join(tempDir, `scene_${scene.scene}.jpg`);
      await downloadImage(imageUrl, imagePath);
      console.log(`[VIDEO] 장면 ${scene.scene} 이미지 다운로드 완료`);

      // ✅ [수정] 화자별 음성을 적용하여 TTS 생성
      console.log(`[VIDEO] 장면 ${scene.scene} TTS 생성 시작 (voicePref: ${voicePref})`);
      const audioBuffer = await generateSceneTTS(scene.text, userData.name, voicePref);
      const audioPath = path.join(tempDir, `scene_${scene.scene}.wav`);
      fs.writeFileSync(audioPath, audioBuffer);
      console.log(`[VIDEO] 장면 ${scene.scene} TTS 생성 완료 (화자별 음성 적용, voicePref: ${voicePref})`);

      // 2-4. 이미지 + 오디오 -> 비디오 생성
      const videoPath = path.join(tempDir, `scene_${scene.scene}.mp4`);
      // ✅ [수정] 오디오 길이에 맞춰 동영상을 생성합니다
      await createVideoFromImageAndAudio(imagePath, audioPath, videoPath);
      sceneVideos.push(videoPath);
      console.log(`[VIDEO] 장면 ${scene.scene} 비디오 생성 완료`);
    }

    // 3. 모든 장면 비디오를 하나로 결합
    console.log("[VIDEO] 모든 장면을 하나의 동영상으로 결합 중...");
    const finalVideoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
    await concatenateVideos(sceneVideos, finalVideoPath);

    // 4. 임시 파일 정리
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log("[VIDEO] 최종 동영상 생성 성공:", videoId);

  } catch (error) {
    console.error("❌ [오류] 동영상 생성 실패:", error);
    if (error.code) console.error("에러 코드:", error.code);
    if (error.message) console.error("에러 메시지:", error.message);

    // 임시 파일 정리
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 백그라운드 작업이므로 클라이언트에 응답을 보낼 수 없음. 콘솔에 에러 기록.
    console.error(`[백그라운드 오류] videoId ${videoId} 생성 실패:`, error.message);
  }
}

// [POST] /api/video/generate - 동영상 생성 요청 접수
router.post("/generate", async (req, res) => {
  const { story, userData } = req.body;

  if (!story || !userData || !userData.name || !userData.emotion) {
    return res.status(400).json({ message: "동화 내용, 이름, 감정은 필수입니다." });
  }

  const videoId = `video_${Date.now()}`;
  const tempDir = path.join(TEMP_DIR, videoId);
  fs.mkdirSync(tempDir, { recursive: true });

  // ✅ [수정] 클라이언트에게 즉시 응답을 보냅니다.
  res.status(202).json({
    success: true,
    message: "동영상 생성 작업이 시작되었습니다. 완료되면 알림이 표시됩니다.",
    videoId: videoId,
  });

  // ✅ [수정] 응답을 보낸 후, 백그라운드에서 동영상 생성 로직을 실행합니다.
  // 'await'를 사용하지 않아 요청-응답 사이클을 차단하지 않습니다.
  processVideoGeneration(story, userData, videoId, tempDir, req.headers.authorization).catch(error => { // userToken 전달
    // ✅ [수정] 백그라운드 작업 실패 시 더 상세한 에러 로그를 남깁니다.
    console.error(`🚨 [백그라운드 오류] videoId ${videoId} 생성 실패:`, error.message);
    if (error.stack) console.error(error.stack);

    // 여기서 실패하더라도 사용자에게 직접 응답을 보낼 수 없으므로 로그만 남깁니다.
  });
});

// [GET] /api/video/status/:videoId - 동영상 생성 상태 확인
router.get("/status/:videoId", (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // 보안 검사: videoId 형식이 맞는지 확인
  if (!videoId.startsWith('video_') || !/^[a-zA-Z0-9_]+$/.test(videoId)) {
    return res.status(400).json({ message: "잘못된 동영상 ID 형식입니다." });
  }

  // 파일이 존재하면 완료, 없으면 진행 중
  if (fs.existsSync(videoPath)) {
    return res.status(200).json({
      status: "completed",
      videoId: videoId,
      downloadUrl: `/api/video/download/${videoId}`
    });
  } else {
    return res.status(200).json({
      status: "processing",
      videoId: videoId
    });
  }
});

// [GET] /api/video/download/:videoId - 동영상 다운로드
router.get("/download/:videoId", (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // ✅ [추가] 간단한 보안 검사: videoId 형식이 맞는지 확인합니다.
  if (!videoId.startsWith('video_') || !/^[a-zA-Z0-9_]+$/.test(videoId)) {
    return res.status(400).json({ message: "잘못된 동영상 ID 형식입니다." });
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ message: "동영상을 찾을 수 없습니다." });
  }

  res.download(videoPath, `fairytale_${videoId}.mp4`, (err) => {
    if (err) {
      console.error("동영상 다운로드 오류:", err);
      res.status(500).json({ message: "동영상 다운로드 중 오류가 발생했습니다." });
    }
  });
});

module.exports = router;
