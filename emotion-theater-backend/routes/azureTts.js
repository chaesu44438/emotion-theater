const express = require("express");
const router = express.Router();
const sdk = require("microsoft-cognitiveservices-speech-sdk");

// 환경 변수에서 Azure Speech Service 키와 지역을 가져옵니다.
const speechConfig = sdk.SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY,
  process.env.AZURE_SPEECH_REGION
);

// 음성 출력 형식 설정 (예: 고품질 MP3)
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz160KbitRateMonoMp3;

// --- Voice Maps ---

// ✅ [추가] English Voice Map
function getVoiceMap_en(defaultVoicePref = "female") {
  const femaleNarrator = { name: "en-US-JennyNeural", pitch: "0%", rate: "0%" };
  const maleNarrator = { name: "en-US-GuyNeural", pitch: "0%", rate: "0%" };

  return {
    narrator: defaultVoicePref === "male" ? maleNarrator : femaleNarrator,
    child: defaultVoicePref === "male" ? { ...maleNarrator, pitch: "+10%" } : { ...femaleNarrator, pitch: "+10%" },
    mother: { ...femaleNarrator, pitch: "+5%" },
    father: { ...maleNarrator, pitch: "-5%" },
    grandmother: { ...femaleNarrator, pitch: "-5%", rate: "-5%" },
    grandfather: { ...maleNarrator, pitch: "-10%", rate: "-10%" },
    smallAnimal: defaultVoicePref === "male" ? { ...maleNarrator, pitch: "+15%" } : { ...femaleNarrator, pitch: "+15%" },
    largeAnimal: { ...maleNarrator, pitch: "-15%" },
  };
}

// ✅ [수정] Korean Voice Map (기존 getVoiceMap)
function getVoiceMap_ko(defaultVoicePref = "female") {
  const femaleNarrator = { name: "ko-KR-SunHiNeural", pitch: "0%", rate: "0%" };
  const femaleChild = { name: "ko-KR-JiMinNeural", pitch: "+2st", rate: "0%" };
  const femaleMother = { name: "ko-KR-SunHiNeural", pitch: "+1st", rate: "0%" };
  const femaleGrandmother = { name: "ko-KR-SunHiNeural", pitch: "0%", rate: "-5%" };

  const maleNarrator = { name: "ko-KR-InJoonNeural", pitch: "0%", rate: "0%" };
  const maleChild = { name: "ko-KR-InJoonNeural", pitch: "+2st", rate: "0%" };
  const maleFather = { name: "ko-KR-InJoonNeural", pitch: "-1st", rate: "0%" };
  const maleGrandfather = { name: "ko-KR-BongJinNeural", pitch: "-2st", rate: "-5%" };

  return {
    narrator: defaultVoicePref === "male" ? maleNarrator : femaleNarrator,
    child: defaultVoicePref === "male" ? maleChild : femaleChild,
    mother: femaleMother,
    father: maleFather,
    grandmother: femaleGrandmother,
    grandfather: maleGrandfather,
    smallAnimal: defaultVoicePref === "male" ? maleChild : femaleChild,
    largeAnimal: maleGrandfather
  };
}

// ✅ [추가] Chinese Voice Map
function getVoiceMap_zh(defaultVoicePref = "female") {
    const femaleNarrator = { name: "zh-CN-XiaoxiaoNeural", pitch: "0%", rate: "0%" };
    const maleNarrator = { name: "zh-CN-YunjianNeural", pitch: "0%", rate: "0%" };
    const femaleChild = { name: "zh-CN-XiaoyouNeural", pitch: "0%", rate: "0%" };

    return {
        narrator: defaultVoicePref === "male" ? maleNarrator : femaleNarrator,
        child: defaultVoicePref === "male" ? { ...maleNarrator, pitch: "+10%" } : femaleChild,
        mother: { ...femaleNarrator, pitch: "+5%" },
        father: { ...maleNarrator, pitch: "-5%" },
        grandmother: { ...femaleNarrator, pitch: "-5%", rate: "-5%" },
        grandfather: { ...maleNarrator, pitch: "-10%", rate: "-10%" },
        smallAnimal: { ...femaleChild, pitch: "+5%", rate: "0%" },
        largeAnimal: { ...maleNarrator, pitch: "-15%" },
    };
}

// ✅ [추가] Japanese Voice Map
function getVoiceMap_ja(defaultVoicePref = "female") {
    const femaleNarrator = { name: "ja-JP-NanamiNeural", pitch: "0%", rate: "0%" };
    const maleNarrator = { name: "ja-JP-KeitaNeural", pitch: "0%", rate: "0%" };

    return {
        narrator: defaultVoicePref === "male" ? maleNarrator : femaleNarrator,
        child: defaultVoicePref === "male" ? { ...maleNarrator, pitch: "+10%" } : { ...femaleNarrator, pitch: "+10%" },
        mother: { ...femaleNarrator, pitch: "+5%" },
        father: { ...maleNarrator, pitch: "-5%" },
        grandmother: { ...femaleNarrator, pitch: "-5%", rate: "-5%" },
        grandfather: { ...maleNarrator, pitch: "-10%", rate: "-10%" },
        smallAnimal: defaultVoicePref === "male" ? { ...maleNarrator, pitch: "+15%" } : { ...femaleNarrator, pitch: "+15%" },
        largeAnimal: { ...maleNarrator, pitch: "-15%" },
    };
}


// ✅ [수정] 화자 이름으로 목소리 찾기 (언어 지원 추가)
function getVoiceForSpeaker(speaker, language, defaultVoicePref = "female") {
  const s = speaker.toLowerCase().trim();

  if (language === 'en') {
    const VOICE_MAP = getVoiceMap_en(defaultVoicePref);
    if (s.includes('narrator')) return VOICE_MAP.narrator;
    if (s.includes('mother')) return VOICE_MAP.mother;
    if (s.includes('father')) return VOICE_MAP.father;
    if (s.includes('grandmother')) return VOICE_MAP.grandmother;
    if (s.includes('grandfather')) return VOICE_MAP.grandfather;
    if (s.match(/rabbit|squirrel|bird|puppy|kitten|mouse|cub/)) return VOICE_MAP.smallAnimal;
    if (s.match(/bear|owl|tiger|lion|elephant/)) return VOICE_MAP.largeAnimal;
    return VOICE_MAP.child; // Default to child
  }

  if (language === 'zh') {
    const VOICE_MAP = getVoiceMap_zh(defaultVoicePref);
    // 중국어는 화자 이름 매칭이 복잡하므로, 우선 나레이터와 기본 목소리 위주로 단순하게 처리
    if (s.includes('旁白') || s.includes('narrator')) return VOICE_MAP.narrator;
    if (s.includes('妈妈') || s.includes('母亲')) return VOICE_MAP.mother;
    if (s.includes('爸爸') || s.includes('父亲')) return VOICE_MAP.father;
    return VOICE_MAP.child;
  }

  if (language === 'ja') {
    const VOICE_MAP = getVoiceMap_ja(defaultVoicePref);
    // 일본어도 화자 이름 매칭이 복잡하므로, 우선 나레이터와 기본 목소리 위주로 단순하게 처리
    if (s.includes('ナレーター') || s.includes('narrator')) return VOICE_MAP.narrator;
    if (s.includes('母') || s.includes('お母さん')) return VOICE_MAP.mother;
    if (s.includes('父') || s.includes('お父さん')) return VOICE_MAP.father;
    return VOICE_MAP.child;
  }

  // Default to Korean
  const VOICE_MAP = getVoiceMap_ko(defaultVoicePref);
  if (s.includes('나레이터') || s.includes('narrator')) return VOICE_MAP.narrator;
  if (s.includes('엄마') || s.includes('어머니')) return VOICE_MAP.mother;
  if (s.includes('아빠') || s.includes('아버지')) return VOICE_MAP.father;
  if (s.includes('할머니')) return VOICE_MAP.grandmother;
  if (s.includes('할아버지')) return VOICE_MAP.grandfather;
  if (s.match(/토끼|다람쥐|새|병아리|강아지|고양이|쥐|새끼/)) return VOICE_MAP.smallAnimal;
  if (s.match(/곰|부엉이|호랑이|사자|코끼리/)) return VOICE_MAP.largeAnimal;
  return VOICE_MAP.child;
}

// ✅ [수정] 대본 형식 텍스트를 SSML로 변환하는 함수 (언어 지원 추가)
function convertTextToSSML(text, language = 'ko', defaultVoicePref = "female") {
  const langCodeMap = {
    en: 'en-US',
    ko: 'ko-KR',
    zh: 'zh-CN',
    ja: 'ja-JP',
  };
  const langCode = langCodeMap[language] || 'ko-KR';
  let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langCode}">\n`;

  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const groups = [];
  let currentSpeaker = null;
  let currentVoice = null;
  let currentDialogues = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    let speaker, dialogue, voice;

    if (colonIndex === -1) {
      const narratorNames = { en: 'Narrator', ko: '나레이터', zh: '旁白', ja: 'ナレーター' };
      speaker = narratorNames[language] || '나레이터';
      dialogue = trimmed; // Initial assumption: whole line is dialogue

      // Explicitly check for common speaker prefixes and remove them if found
      const speakerPrefixes = {
        ko: ['나레이터', '엄마', '아빠', '할머니', '할아버지', '토끼', '다람쥐', '새', '병아리', '강아지', '고양이', '쥐', '새끼', '곰', '부엉이', '호랑이', '사자', '코끼리'],
        en: ['Narrator', 'Mother', 'Father', 'Grandmother', 'Grandfather', 'Rabbit', 'Squirrel', 'Bird', 'Puppy', 'Kitten', 'Mouse', 'Cub', 'Bear', 'Owl', 'Tiger', 'Lion', 'Elephant'],
        zh: ['旁白', '妈妈', '母亲', '爸爸', '父亲', '奶奶', '爷爷', '兔子', '松鼠', '鸟', '小狗', '小猫', '老鼠', '熊', '猫头鹰', '老虎', '狮子', '大象'], // Simplified Chinese
        ja: ['ナレーター', '母', 'お母さん', '父', 'お父さん', 'おばあさん', 'おじいさん', 'うさぎ', 'リス', '鳥', '子犬', '子猫', 'ねずみ', 'クマ', 'フクロウ', 'トラ', 'ライオン', 'ゾウ'], // Japanese
      };

      const currentSpeakerPrefixes = speakerPrefixes[language] || [];
      for (const prefix of currentSpeakerPrefixes) {
        // Check if the line starts with "Prefix: " or "Prefix "
        const regex = new RegExp(`^${prefix}(:|\\s)`, 'i'); // Case-insensitive
        if (dialogue.match(regex)) {
          dialogue = dialogue.replace(regex, '').trim();
          speaker = prefix; // Update speaker to the matched prefix
          break; // Found a speaker, no need to check further
        }
      }

      voice = getVoiceForSpeaker(speaker, language, defaultVoicePref);
    } else {
      speaker = trimmed.substring(0, colonIndex).trim();
      dialogue = trimmed.substring(colonIndex + 1).trim(); // Here, dialogue is after colon
      if (!dialogue) continue;
      voice = getVoiceForSpeaker(speaker, language, defaultVoicePref);
    }

    if (currentSpeaker === speaker) {
      currentDialogues.push(dialogue);
    } else {
      if (currentSpeaker !== null) {
        groups.push({ voice: currentVoice, dialogues: currentDialogues });
      }
      currentSpeaker = speaker;
      currentVoice = voice;
      currentDialogues = [dialogue];
    }
  }

  if (currentSpeaker !== null) {
    groups.push({ voice: currentVoice, dialogues: currentDialogues });
  }

  const MAX_VOICE_ELEMENTS = 50;
  if (groups.length > MAX_VOICE_ELEMENTS) {
    console.log(`[TTS] voice 태그 수가 ${groups.length}개로 제한(${MAX_VOICE_ELEMENTS}개)을 초과하여 그룹 병합을 시작합니다.`);
    while (groups.length > MAX_VOICE_ELEMENTS) {
      let shortestGroupIndex = -1;
      let minLength = Infinity;
      for (let i = 0; i < groups.length; i++) {
        const groupLength = groups[i].dialogues.join("").length;
        if (groupLength < minLength) {
          minLength = groupLength;
          shortestGroupIndex = i;
        }
      }
      if (shortestGroupIndex > 0) {
        const groupToMerge = groups.splice(shortestGroupIndex, 1)[0];
        groups[shortestGroupIndex - 1].dialogues.push(...groupToMerge.dialogues);
      } else {
        const groupToMerge = groups.splice(0, 1)[0];
        if (groups.length > 0) {
            groups[0].dialogues.unshift(...groupToMerge.dialogues);
        } else {
            groups.push(groupToMerge); // Handle case where there's only one group left
        }
      }
    }
  }

  for (const group of groups) {
    ssml += `  <voice name="${group.voice.name}">\n`;
    ssml += `    <prosody rate="${group.voice.rate}" pitch="${group.voice.pitch}">`;
    for (let i = 0; i < group.dialogues.length; i++) {
      // ✅ [추가] 감정 표현 적용
      const emotionalDialogue = addEmotionToText(group.dialogues[i]);
      ssml += emotionalDialogue;
      if (i < group.dialogues.length - 1) {
        ssml += '<break time="400ms"/>';
      }
    }
    ssml += '<break time="500ms"/></prosody>\n';
    ssml += `  </voice>\n`;
  }

  ssml += '</speak>';
  console.log(`[TTS] voice 태그 수: ${groups.length}개 (최대 50개)`);
  return ssml;
}

// XML 특수문자 이스케이프
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

router.post("/synthesize", async (req, res) => {
  const { text, voice, language = 'ko' } = req.body; // ✅ language 파라미터 추가, 기본값 'ko'

  if (!text) {
    return res.status(400).send("음성으로 변환할 텍스트가 필요합니다.");
  }

  try {
    console.log(`[TTS] 동화 텍스트를 SSML로 변환 중... (언어: ${language})`);
    console.log("[TTS] 원본 텍스트 길이:", text.length, "글자");

    // 1. 텍스트를 SSML로 변환
    const ssml = convertTextToSSML(text, language, voice); // ✅ language와 voice 전달

    console.log("[TTS] SSML 변환 완료, 음성 합성 시작...");
    console.log("[TTS] SSML 길이:", ssml.length, "글자");

    // 2. SSML을 음성으로 합성
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioData = Buffer.from(result.audioData);
          console.log("[TTS] 음성 합성 성공! 오디오 크기:", audioData.length, "bytes");
          res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audioData.length });
          res.end(audioData);
        } else {
          console.error("[TTS] 음성 합성 실패:", result.errorDetails);
          res.status(500).send("음성 합성 실패");
        }
      },
      (err) => {
        console.error("[TTS] speakSsmlAsync 오류:", err);
        synthesizer.close();
        res.status(500).send("음성 합성 오류");
      }
    );
  } catch (error) {
    console.error("[TTS] 라우트 오류:", error);
    res.status(500).send("서버 내부 오류가 발생했습니다.");
  }
});

module.exports = router;
