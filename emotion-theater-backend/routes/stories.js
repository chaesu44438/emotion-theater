const express = require("express");
const {
  storiesContainer,
  settingsContainer,
  DEFAULT_STORY_PROMPT, // ✅ db.js에서 가져오기
  DEFAULT_IMAGE_PROMPT_SYSTEM, // ✅ db.js에서 가져오기
} = require("../db");
const { AzureOpenAI } = require("openai"); // ✅ OpenAI 대신 AzureOpenAI를 가져옵니다.
const router = express.Router();

// ✅ [수정] 텍스트 생성용(GPT) OpenAI 클라이언트 초기화
const textClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  timeout: 180000, // ✅ [추가] API 호출 타임아웃 3분
});

// ✅ [수정] 이미지 생성용(DALL-E) OpenAI 클라이언트 초기화
const dalleClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_DALLE_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_DALLE_KEY,
  apiVersion: process.env.AZURE_OPENAI_DALLE_API_VERSION, // ✅ DALL-E 전용 API 버전 사용
  timeout: 180000,
});


// [POST] /api/stories/generate - 동화 및 삽화 생성
router.post("/generate", async (req, res) => { // ✅ 이 라우트가 이제 텍스트와 프롬프트를 모두 생성합니다.
  // ✅ [수정] 참조 이미지 URL을 요청 본문에서 받아옵니다.
  const { name, category, age, emotion, comment, referenceImageUrl } = req.body;
  const userId = req.user.userId; // 인증 미들웨어에서 추가해 준 사용자 정보

  if (!name || !emotion) {
    return res.status(400).json({ message: "이름과 감정은 필수입니다." });
  }

  try {
    // DB에서 프롬프트 설정 가져오기
    let storyPromptTemplate = DEFAULT_STORY_PROMPT;
    let imagePromptSystem = DEFAULT_IMAGE_PROMPT_SYSTEM;

    try {
      const { resource: storyPromptSetting } = await settingsContainer.item("storyPrompt", "prompt").read();
      if (storyPromptSetting) storyPromptTemplate = storyPromptSetting.value;

      const { resource: imagePromptSetting } = await settingsContainer.item("imagePromptSystem", "prompt").read();
      if (imagePromptSetting) imagePromptSystem = imagePromptSetting.value;
    } catch (e) {
      console.log("[Prompt] DB에 저장된 프롬프트 설정이 없어 기본값을 사용합니다.");
    }

    console.log("[API] 동화 내용 및 삽화 프롬프트 동시 생성을 시작합니다...");
    const storyPrompt = storyPromptTemplate
      .replace('{name}', name)
      .replace('{category}', category === 'child' ? '어린이' : '어른')
      .replace('{age}', age)
      .replace('{emotion}', emotion)
      .replace('{comment}', comment || "없음");

    // ✅ [추가] 이미지 프롬프트 생성을 위한 Promise 변수 선언
    let imagePromptGenerationPromise;

    // ✅ [추가] 참조 이미지가 있으면 Vision API를, 없으면 기존 방식을 사용합니다.
    if (referenceImageUrl) {
      console.log("[API] 참조 이미지를 사용하여 삽화 프롬프트를 생성합니다. (Vision API)");
      // ✅ [수정] 나이 정보를 명확하게 포함하여 전달합니다.
      imagePromptGenerationPromise = textClient.chat.completions.create({
        // 중요: 이 모델 배포 이름은 Vision을 지원하는 모델이어야 합니다. (예: gpt-4-vision-preview, gpt-4o)
        model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
        messages: [
          { role: "system", content: imagePromptSystem },
          {
            role: "user",
            content: [
              { type: "text", text: `Create a prompt based on the user input and the provided image.\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` },
              {
                type: "image_url",
                image_url: { "url": referenceImageUrl, "detail": "low" }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.6,
      });
    } else {
      console.log("[API] 텍스트 정보만으로 삽화 프롬프트를 생성합니다.");
      imagePromptGenerationPromise = textClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
        messages: [
          { role: "system", content: imagePromptSystem },
          { role: "user", content: `Create a prompt based on this user input:\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` }
        ],
        max_tokens: 200,
        temperature: 0.6,
      });
    }

    // ✅ [수정] 두 개의 API 호출을 Promise.all로 동시에 실행합니다.
    const [storyResponse, imagePromptResponse] = await Promise.all([
      // 1. 동화 텍스트 생성
      textClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
        messages: [
          {
            role: "system",
            content: "You are a kind and creative storyteller. This is for educational and therapeutic purposes to help children process emotions through storytelling. Always complete stories with a positive ending."
          },
          { role: "user", content: storyPrompt }
        ],
        max_tokens: 2500,
        temperature: 0.8
      }),
      // 2. 삽화 프롬프트 생성
      imagePromptGenerationPromise
    ]);

    const story = storyResponse.choices[0]?.message?.content?.trim() || "동화 생성에 실패했습니다.";
    const imagePrompt = imagePromptResponse.choices[0]?.message?.content?.trim() || "A beautiful and heartwarming fairy tale scene";

    console.log("[API] 동화 내용 및 삽화 프롬프트 생성 성공! 이제 DALL-E 이미지를 생성합니다...");
    console.log("🎨 DALL-E Image Generation Prompt:", imagePrompt);

    // 3. 생성된 프롬프트로 DALL-E 이미지 생성 (상단에서 초기화된 dalleClient 사용)
    const imageResponse = await dalleClient.images.generate({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE, // .env 파일에 설정된 DALL-E 배포 이름 (예: dall-e-3)
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024", // DALL-E 3에서 지원하는 가로가 긴 비율
      quality: "standard", // 또는 "hd"
    });

    const illustrationUrl = imageResponse.data[0].url;
    console.log("[API] DALL-E 이미지 생성 성공! URL:", illustrationUrl);

    // ✅ [수정] 동화 내용과 DALL-E 이미지 URL을 한 번에 클라이언트로 보냅니다.
    res.status(200).json({ story, illustrationUrl });

  } catch (error) {
    console.error("❌ [오류] 동화 생성(Chat Completion) 실패:", error);

    // ✅ [추가] 더 자세한 에러 정보 로깅
    if (error.code) console.error("에러 코드:", error.code);
    if (error.response) {
      console.error("API 응답 상태:", error.response.status);
      console.error("API 응답 데이터:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.message) console.error("에러 메시지:", error.message);
    if (error.stack) console.error("스택 트레이스:", error.stack);

    // ✅ [추가] 클라이언트에 더 구체적인 에러 메시지 전달
    let userMessage = "동화 생성 중 오류가 발생했습니다.";

    // 특정 에러 유형별 메시지
    if (error.code === 'content_filter') {
      userMessage = "입력 내용이 안전 필터에 의해 차단되었습니다. 다른 내용으로 시도해주세요.";
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      userMessage = "Azure OpenAI 서비스에 연결할 수 없습니다. 네트워크를 확인해주세요.";
    } else if (error.message?.includes('timeout')) {
      userMessage = "요청 시간이 초과되었습니다. 다시 시도해주세요.";
    } else if (error.message?.includes('safety system')) {
      userMessage = "안전 시스템에 의해 요청이 거부되었습니다. 입력 내용을 수정해주세요.";
    } else if (error.response?.status === 401) {
      userMessage = "API 키가 유효하지 않습니다. 관리자에게 문의하세요.";
    } else if (error.response?.status === 429) {
      userMessage = "API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
    }

    res.status(500).json({
      message: userMessage,
      error: error.message,
      details: error.response?.data
    });
  }
});

// [POST] /api/stories/regenerate-prompt - 삽화 프롬프트만 재생성
router.post("/regenerate-prompt", async (req, res) => {
  const { story, userData } = req.body; // story는 현재 사용되지 않지만, 확장성을 위해 유지합니다.
  const { name, age, emotion, comment, referenceImageUrl } = userData; // ✅ [수정] age 추가

  if (!story || !name || !emotion) {
    return res.status(400).json({ message: "동화 내용, 이름, 감정은 필수입니다." });
  }

  try {
    let imagePromptSystem = DEFAULT_IMAGE_PROMPT_SYSTEM;
    try {
      const { resource: imagePromptSetting } = await settingsContainer.item("imagePromptSystem", "prompt").read();
      if (imagePromptSetting) imagePromptSystem = imagePromptSetting.value;
    } catch (e) {
      console.log("[Prompt] DB에 저장된 이미지 프롬프트 설정이 없어 기본값을 사용합니다.");
    }

    let imagePromptResponse;

    // ✅ [수정] 참조 이미지가 있는 경우와 없는 경우를 분기하여 처리합니다.
    if (referenceImageUrl) {
      console.log("[API] 참조 이미지를 사용하여 삽화 프롬프트를 재생성합니다. (Vision API)");
      // ✅ [수정] 나이 정보를 명확하게 포함
      imagePromptResponse = await textClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
        messages: [
          { role: "system", content: imagePromptSystem },
          {
            role: "user",
            content: [
              { type: "text", text: `Create a new, slightly different prompt based on the user input and the provided image.\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` },
              {
                type: "image_url",
                image_url: { "url": referenceImageUrl, "detail": "low" }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.7, // 약간의 창의성을 더 부여
      });
    } else {
      console.log("[API] 텍스트 정보만으로 삽화 프롬프트를 재생성합니다.");
      imagePromptResponse = await textClient.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
        messages: [
          { role: "system", content: imagePromptSystem },
          { role: "user", content: `Create a new, slightly different prompt based on this user input:\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });
    }

    const imagePrompt = imagePromptResponse.choices[0]?.message?.content?.trim() || "A beautiful and heartwarming fairy tale scene";
    
    console.log("[API] 삽화 프롬프트 재생성 성공! 이제 DALL-E 이미지를 재생성합니다...");
    console.log("🎨 DALL-E Regenerated Image Prompt:", imagePrompt);

    // ✅ [수정] 새로운 프롬프트로 DALL-E 이미지 생성 (상단에서 초기화된 dalleClient 사용)
    const imageResponse = await dalleClient.images.generate({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE,
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
    });

    res.status(200).json({ illustrationUrl: imageResponse.data[0].url });
  } catch (error) {
    console.error("❌ [오류] 삽화 프롬프트 재생성 실패:", error);
    res.status(500).json({ message: "삽화 프롬프트 재생성 중 오류가 발생했습니다." });
  }
});

// [POST] /api/stories - 동화 저장
router.post("/", async (req, res) => {
  const storyData = req.body;
  const userId = req.user.userId;

  const newItem = {
    userId, // 파티션 키
    ...storyData,
    createdAt: new Date().toISOString(),
  };

  try {
    const { resource: createdItem } = await storiesContainer.items.create(newItem);
    res.status(201).json(createdItem);
  } catch (error) {
    console.error("동화 저장 오류:", error);
    res.status(500).json({ message: "동화 저장 중 오류가 발생했습니다." });
  }
});

// [GET] /api/stories - 특정 사용자의 동화 목록 조회
router.get("/", async (req, res) => {
  const userId = req.user.userId;
  let retries = 1; // 재시도 횟수

  const fetchStories = async () => {
    try {
      const { resources: items } = await storiesContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();
      return items;
    } catch (error) {
      // ECONNRESET 오류이고, 재시도 횟수가 남아있으면 다시 시도
      if (error.code === 'ECONNRESET' && retries > 0) {
        console.warn(`[DB] 동화 목록 조회 중 ECONNRESET 오류 발생. ${retries}번 재시도합니다...`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
        return fetchStories(); // 재귀적으로 재시도
      }
      // 그 외의 오류는 그대로 throw
      throw error;
    }
  };

  try {
    const stories = await fetchStories();
    res.status(200).json(stories);
  } catch (error) {
    console.error("❌ [오류] 동화 목록 조회 최종 실패:", error);
    res.status(500).json({ message: "동화 목록을 불러오는 중 오류가 발생했습니다." });
  }
});

// [DELETE] /api/stories/:id - 특정 동화 삭제
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    // userId를 파티션 키로 함께 전달해야 정확한 항목을 찾을 수 있습니다.
    await storiesContainer.item(id, userId).delete();
    res.status(204).send(); // 성공적으로 삭제되었으나 본문 내용은 없음
  } catch (error) {
    if (error.code === 404) {
      return res.status(404).json({ message: "삭제할 동화를 찾을 수 없습니다." });
    }
    console.error("동화 삭제 오류:", error);
    res.status(500).json({ message: "동화 삭제 중 오류가 발생했습니다." });
  }
});

// ✅ [추가] 이 라우트의 타임아웃을 5분으로 설정합니다.
router.post("/generate-video-scenes", (req, res, next) => {
  req.setTimeout(300000); // 5분
  next();
});
// [POST] /api/stories/generate-video-scenes - 동화를 장면으로 분할하고 각 장면별 삽화 생성
router.post("/generate-video-scenes", async (req, res) => {
  const { story, userData } = req.body;
  // ✅ [수정] userData에서 모든 관련 정보를 추출합니다.
  const { name, age, emotion, comment, referenceImageUrl } = userData;

  if (!story || !name || !emotion || !age) {
    return res.status(400).json({ message: "동화 내용, 이름, 나이, 감정은 필수입니다." });
  }

  try {
    console.log("[VIDEO] 동화를 4개 장면으로 분할 시작...");

    // 1. 동화를 4개 장면으로 분할
    const sceneSplitPrompt = `다음 대본 형식 동화를 문맥의 흐름에 맞게 자연스럽게 4개의 장면으로 나누어주세요.

**중요 규칙:**
1. 원본 텍스트의 "화자: 대사" 형식을 **절대 변경하지 말고 그대로 유지**하세요
2. 모든 대화와 나레이션을 **빠짐없이 모두 포함**하세요
3. 요약하거나 생략하지 말고 **원문을 그대로** 4개 장면으로 나누기만 하세요
4. 각 장면은 동화의 일부분이며, 4개를 합치면 전체 동화가 됩니다

동화 내용:
${story}

출력 형식:
각 장면을 JSON 배열로 반환해주세요. 각 장면은 {"scene": 장면번호, "text": "장면 내용"} 형식입니다.
예시:
[
  {"scene": 1, "text": "나레이터: 옛날 옛적에...\n주인공: 안녕하세요!\n나레이터: 주인공이 말했어요."},
  {"scene": 2, "text": "엄마: 어디 가니?\n주인공: 학교에 가요!\n나레이터: 대답했어요."},
  {"scene": 3, "text": "나레이터: 길을 걷다가...\n새: 짹짹!\n주인공: 새가 날아가네요."},
  {"scene": 4, "text": "나레이터: 모두 행복하게 살았답니다."}
]

**다시 강조: 원본의 '화자: 대사' 형식을 절대 변경하지 말고, 모든 대화를 포함하세요!**
반드시 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.`;

    const sceneSplitResponse = await textClient.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
      messages: [
        { role: "system", content: "당신은 대본 형식 동화를 장면별로 나누는 전문가입니다. 원본의 '화자: 대사' 형식을 절대 변경하지 말고 그대로 유지하며, 모든 대화와 나레이션을 빠짐없이 포함해야 합니다. 항상 JSON 형식으로만 응답합니다." },
        { role: "user", content: sceneSplitPrompt }
      ],
      max_tokens: 3000, // ✅ 모든 대화를 포함하기 위해 토큰 수 증가
      temperature: 0.1, // ✅ 창의성을 낮춰 원본 유지
    });

    const scenesText = sceneSplitResponse.choices[0]?.message?.content?.trim() || "[]";
    let scenes;
    try {
      scenes = JSON.parse(scenesText);
    } catch (e) {
      console.error("JSON 파싱 오류:", e);
      // JSON이 아닌 경우, 동화를 단순히 4등분
      const lines = story.split('\n').filter(line => line.trim());
      const chunkSize = Math.ceil(lines.length / 4);
      scenes = [];
      for (let i = 0; i < 4; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, lines.length);
        scenes.push({
          scene: i + 1,
          text: lines.slice(start, end).join('\n')
        });
      }
    }

    console.log(`[VIDEO] ${scenes.length}개 장면으로 분할 완료`);

    // ✅ [추가] 분할된 장면 내용 로그 출력
    scenes.forEach((scene, index) => {
      console.log(`[VIDEO] 장면 ${index + 1} 내용 (처음 200자):`);
      console.log(scene.text.substring(0, 200));
      console.log('---');
    });

    // 2. 각 장면별로 삽화 프롬프트 생성
    console.log("[VIDEO] 각 장면별 삽화 프롬프트 생성 시작...");

    let imagePromptSystem = DEFAULT_IMAGE_PROMPT_SYSTEM;
    try {
      const { resource: imagePromptSetting } = await settingsContainer.item("imagePromptSystem", "prompt").read();
      if (imagePromptSetting) imagePromptSystem = imagePromptSetting.value;
    } catch (e) {
      console.log("[Prompt] DB에 저장된 이미지 프롬프트 설정이 없어 기본값을 사용합니다.");
    }

    const scenePromises = scenes.map(async (scene) => {
      let imagePromptResponse;

      // ✅ [수정] 참조 이미지가 있으면 Vision API를, 없으면 텍스트 기반으로 프롬프트를 생성합니다.
      if (referenceImageUrl) {
        console.log(`[VIDEO] 장면 ${scene.scene}: 참조 이미지를 사용하여 삽화 프롬프트 생성 (Vision)`);
        imagePromptResponse = await textClient.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
          messages: [
            { role: "system", content: imagePromptSystem }, // 상세한 시스템 프롬프트 사용
            {
              role: "user",
              content: [
                { type: "text", text: `Create a prompt for a scene illustration based on the user input and the provided image.\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n- Scene Summary: ${scene.text.substring(0, 150)}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` },
                { type: "image_url", image_url: { "url": referenceImageUrl, "detail": "low" } }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.6,
        });
      } else {
        console.log(`[VIDEO] 장면 ${scene.scene}: 텍스트 정보만으로 삽화 프롬프트 생성`);
        imagePromptResponse = await textClient.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
          messages: [
            { role: "system", content: imagePromptSystem },
            { role: "user", content: `Create a prompt for a scene illustration.\n- Character Name: ${name}\n- Age: ${age} years old\n- Emotion: ${emotion}\n- Comment: ${comment || 'None'}\n- Scene Summary: ${scene.text.substring(0, 150)}\n\nIMPORTANT: The character MUST be depicted as a ${age}-year-old. Start your prompt with the age descriptor.` }
          ],
          max_tokens: 200,
          temperature: 0.6,
        });
      }

      const imagePrompt = imagePromptResponse.choices[0]?.message?.content?.trim() || "A beautiful fairy tale scene";

      console.log(`[VIDEO] 장면 ${scene.scene} 삽화 프롬프트 생성 완료: ${imagePrompt.substring(0, 50)}...`);

      return {
        scene: scene.scene,
        text: scene.text,
        imagePrompt: imagePrompt
      };
    });

    const scenesWithPrompts = await Promise.all(scenePromises);

    console.log("[VIDEO] 모든 장면의 삽화 프롬프트 생성 완료!");

    res.status(200).json({ scenes: scenesWithPrompts });

  } catch (error) {
    console.error("❌ [오류] 동영상 장면 생성 실패:", error);
    if (error.code) console.error("에러 코드:", error.code);
    if (error.response) {
      console.error("API 응답 상태:", error.response.status);
      console.error("API 응답 데이터:", error.response.data);
    }
    if (error.message) console.error("에러 메시지:", error.message);

    res.status(500).json({ message: "동영상 장면 생성 중 오류가 발생했습니다." });
  }
});

module.exports = router;