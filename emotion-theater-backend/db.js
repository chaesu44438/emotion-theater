// emotion-theater-backend/db.js
const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID;
const usersContainerId = process.env.COSMOS_USERS_CONTAINER_ID;
const storiesContainerId = "Stories"; // ✅ 동화 컨테이너 ID 추가
const settingsContainerId = "Settings"; // ✅ 설정 컨테이너 ID 추가

if (!endpoint || !key || !databaseId || !usersContainerId) {
  throw new Error("Cosmos DB 환경 변수가 .env 파일에 제대로 설정되지 않았습니다. (ENDPOINT, KEY, DATABASE_ID, USERS_CONTAINER_ID)");
}

// ✅ [이동] 기본 프롬프트 변수를 db.js로 이동시켰습니다.
const DEFAULT_STORY_PROMPT = `
당신은 따뜻하고 창의적인 한국어 동화 작가입니다.

주어진 사용자 정보를 바탕으로 감동적이고 교훈적인 동화를 **대본 형식**으로 작성해주세요.

사용자 정보:
- 주인공 이름: {name}
- 대상 연령: {category} ({age}세)
- 오늘의 감정: {emotion}
- 사용자 코멘트: {comment}

작성 규칙:
1. **대본 형식으로 작성** - 각 줄은 "화자: 대사" 형식
2. 분량: 1500~2000자 (완결된 이야기)
3. 등장인물: 나레이터 + 주인공 + 1~2명의 조연 (사람 또는 동물)
4. 결말: 반드시 희망적이고 행복한 결말로 완결
5. 감정: {emotion}과 관련된 감정을 자연스럽게 녹여내기

화자 이름 규칙:
- 나레이터: 지문과 장면 설명
- {name}: 주인공 이름 그대로 사용
- 엄마, 아빠, 할머니, 할아버지: 가족 캐릭터
- 토끼, 다람쥐, 새, 곰, 부엉이 등: 동물 이름 그대로 사용

출력 형식 예시:
나레이터: 어느 화창한 봄날, {name}는 학교에 가는 길이었어요.
{name}: 오늘은 무슨 재미있는 일이 있을까?
나레이터: 그때 작은 토끼 한 마리가 나타났어요.
토끼: 안녕, {name}! 나랑 놀래?
{name}: 좋아! 같이 놀자.
나레이터: 둘은 함께 즐거운 시간을 보냈어요.

중요 사항:
- 각 줄은 반드시 "화자: 대사" 형식
- 대사는 자연스럽고 나이에 맞게
- 빈 줄 없이 연속으로 작성
- 마지막은 나레이터가 따뜻하게 마무리

이제 위 정보를 바탕으로 대본 형식의 동화를 작성해주세요.
`;

const DEFAULT_IMAGE_PROMPT_SYSTEM = `You are a creative assistant specializing in creating prompts for image generation AI. Your task is to generate a highly descriptive English prompt for a fairy tale illustration.

**Instructions:**

1.  **Analyze User Input:** Review the user's input: Character Name, Age, Emotion, and Comment. This provides the core theme.
2.  **AGE-APPROPRIATE CHARACTER DESIGN (CRITICAL):**
    *   **ALWAYS depict the character's age accurately:**
        *   Age 0-3: Toddler or baby with chubby cheeks, small body proportions, very young appearance
        *   Age 4-7: Young child with childish features, small stature
        *   Age 8-12: Pre-teen child with youthful appearance
        *   Age 13-17: Teenager with adolescent features
        *   Age 18+: Adult with mature features
    *   **Use explicit age descriptors** in your prompt (e.g., "2-year-old toddler", "5-year-old child", "10-year-old kid")
3.  **Analyze Reference Image (if provided):**
    *   If the image contains a person, **meticulously describe their key features while maintaining the correct age**.
    *   Include details like:
        *   **Face:** Face shape, eye color and shape, nose, lips, and overall facial expression (adjusted for the specified age)
        *   **Hair:** Color, style (e.g., long and wavy, short and curly), and length
        *   **Clothing:** Age-appropriate style, color, and type of outfit
        *   **Overall Vibe:** The general mood or personality (e.g., cheerful, thoughtful, playful)
4.  **Synthesize and Create Prompt:** Combine the visual details from the reference image with the thematic context and AGE from the user's input.
    *   Your main goal is to create a prompt that will draw the fairy tale's protagonist at the **CORRECT AGE** specified by the user.
    *   The final prompt should be a single, cohesive, and detailed paragraph in English.
    *   **ALWAYS start your prompt with the age descriptor** (e.g., "A 2-year-old toddler...", "A 5-year-old child...")
5.  **Final Output:** Output only the generated prompt text. Do not include any introductory phrases like "Here is the prompt:".`;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const usersContainer = database.container(usersContainerId);
const storiesContainer = database.container(storiesContainerId); // ✅ 동화 컨테이너 객체 추가
const settingsContainer = database.container(settingsContainerId); // ✅ 설정 컨테이너 객체 추가

async function initializeDatabase() {
  // ✅ [수정] 데이터베이스 수준에서 처리량을 1000 RU/s로 공유하도록 설정합니다.
  const { database: db } = await client.databases.createIfNotExists({
    id: databaseId,
    throughput: 1000, // 데이터베이스에만 처리량 1000 RU/s를 할당합니다.
  });
  console.log(`[DB] '${db.id}' 데이터베이스 연결 성공`);

  // ✅ [수정] 각 컨테이너 생성 시 throughput 옵션을 제거하여, 데이터베이스의 공유 처리량을 상속받도록 합니다.
  const { container: users } = await db.containers.createIfNotExists({
    id: usersContainerId,
    partitionKey: { paths: ["/username"] }, // throughput 옵션 없음
  });
  console.log(`[DB] '${users.id}' 컨테이너 연결 성공`);

  const { container: stories } = await db.containers.createIfNotExists({
    id: storiesContainerId,
    partitionKey: { paths: ["/userId"] }, // throughput 옵션 없음
  });
  console.log(`[DB] '${stories.id}' 컨테이너 연결 성공`);

  const { container: settings } = await db.containers.createIfNotExists({
    id: settingsContainerId,
    partitionKey: { paths: ["/type"] }, // throughput 옵션 없음
  });
  console.log(`[DB] '${settings.id}' 컨테이너 연결 성공`);

  // 서버 시작 시 기본 프롬프트가 DB에 없으면 생성/업데이트합니다.
  const storyPromptItem = { id: "storyPrompt", type: "prompt", value: DEFAULT_STORY_PROMPT };
  const imagePromptItem = { id: "imagePromptSystem", type: "prompt", value: DEFAULT_IMAGE_PROMPT_SYSTEM };

  await settingsContainer.items.upsert(storyPromptItem);
  await settingsContainer.items.upsert(imagePromptItem);
  console.log("[DB] 기본 프롬프트 설정 확인 및 초기화 완료.");
}

module.exports = {
  initializeDatabase,
  usersContainer,
  storiesContainer, // ✅ 외부에서 사용할 수 있도록 export
  settingsContainer, // ✅ 설정 컨테이너 export
  DEFAULT_STORY_PROMPT, // ✅ 다른 파일에서 사용할 수 있도록 export
  DEFAULT_IMAGE_PROMPT_SYSTEM, // ✅ 다른 파일에서 사용할 수 있도록 export
};
