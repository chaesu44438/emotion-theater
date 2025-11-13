(function () {
  // ✅ [수정] API 서버 주소를 상대 경로로 변경합니다.
  // 이렇게 하면 live-server의 프록시 설정이 적용되어 localhost:4000으로 요청이 전달됩니다.
  const API_BASE_URL = "/api";

  // JWT 토큰 관리
  const getToken = () => localStorage.getItem("authToken");
  const setToken = (token) => localStorage.setItem("authToken", token);
  const removeToken = () => localStorage.removeItem("authToken");

  // 인증 헤더 생성
  const authHeader = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // API 호출 래퍼
  async function fetchAPI(path, options = {}) {
    // ✅ [추가] 타임아웃 설정 (기본값: 2분, 옵션으로 변경 가능)
    const timeout = options.timeout || 120000; // 120초 = 2분
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // ✅ [추가] 외부에서 취소 신호(signal)가 전달되면, 내부 AbortController도 함께 취소시킵니다.
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API Error (${res.status}): ${errorBody}`);
      }

      // ✅ [수정] 204 No Content 응답은 본문이 없으므로, JSON 파싱을 시도하지 않고 즉시 반환합니다.
      if (res.status === 204) {
        return null;
      }

      return res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        // ✅ [추가] 외부 신호에 의해 취소된 경우, 사용자 정의 에러 메시지를 던집니다.
        if (options.signal && options.signal.aborted) {
          throw new Error('요청이 사용자에 의해 취소되었습니다.');
        }
        throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  };

  // ✅ [추가] 오디오 데이터(Blob)를 직접 받아오는 fetch 래퍼
  async function fetchBlob(path, options = {}) {
    // ✅ [추가] 타임아웃 설정 (기본값: 2분, 옵션으로 변경 가능)
    const timeout = options.timeout || 120000; // 120초 = 2분
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // ✅ [추가] 외부에서 취소 신호(signal)가 전달되면, 내부 AbortController도 함께 취소시킵니다.
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        controller.abort();
      });
    }

    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API Error (${res.status}): ${errorBody}`);
      }
      // JSON이 아닌 Blob 형태로 응답을 반환합니다.
      return res.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        // ✅ [추가] 외부 신호에 의해 취소된 경우, 사용자 정의 에러 메시지를 던집니다.
        if (options.signal && options.signal.aborted) {
          throw new Error('요청이 사용자에 의해 취소되었습니다.');
        }
        throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  };

  window.apiService = {
    // --- 인증 API ---
    async login(username, password) { // ✅ 경로 수정: /login -> /auth/login
      const data = await fetchAPI("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (data.token) {
        setToken(data.token);
      }
      return data;
    },

    // ✅ 회원가입 API 함수 추가
    async register(username, password) {
      return fetchAPI("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    },

    logout() {
      removeToken();
    },

    getCurrentUser() {
      const token = getToken();
      if (!token) return null;
      try {
        // JWT의 payload를 디코딩하여 사용자 정보 확인 (간단한 방식)
        const payload = JSON.parse(atob(token.split(".")[1]));
        return { userId: payload.userId, username: payload.username, role: payload.role }; // ✅ role도 같이 반환
      } catch (e) {
        removeToken();
        return null;
      }
    },

    // --- 관리자 API ---
    async getAllUsers() {
      // 백엔드에 GET /api/admin/users 요청
      return fetchAPI("/admin/users");
    },

    async deleteUser(userId) {
      // 백엔드에 DELETE /api/admin/users/:id 요청
      return fetchAPI(`/admin/users/${userId}`, {
        method: "DELETE",
      });
    },

    // ✅ [추가] 프롬프트 조회 API
    async getPrompts() {
      return fetchAPI("/admin/prompts");
    },

    // ✅ [추가] 프롬프트 업데이트 API
    async updatePrompts(storyPrompt, imagePromptSystem) {
      return fetchAPI("/admin/prompts", {
        method: "PUT",
        body: JSON.stringify({ storyPrompt, imagePromptSystem }),
      });
    },

    // --- 동화 API ---
    async getStories() {
      // 백엔드에 GET /api/stories 구현 필요
      return fetchAPI("/stories");
    },

    async saveStory(storyData) {
      // 백엔드에 POST /api/stories 구현 필요
      return fetchAPI("/stories", {
        method: "POST",
        body: JSON.stringify(storyData),
      });
    },

    async deleteStory(storyId) {
      // 백엔드에 DELETE /api/stories/:id 구현 필요
      return fetchAPI(`/stories/${storyId}`, {
        method: "DELETE",
      });
    },

    /**
     * 1. 백엔드에 동화 생성을 요청합니다.
     * 2. 생성된 동화로 이미지 프롬프트를 만듭니다.
     * 3. Pollinations.ai로 삽화를 생성합니다.
     */
    async generateStory(userData, signal) { // ✅ [수정] signal 파라미터 추가
      // ✅ [수정] 백엔드가 동화 텍스트와 DALL-E 이미지 URL을 모두 생성하여 반환합니다.
      // 프론트엔드에서는 Pollinations.ai URL을 만들 필요가 없습니다.
      return fetchAPI("/stories/generate", {
        signal, // ✅ [수정] fetchAPI에 signal 전달
        method: "POST",
        body: JSON.stringify(userData),
      });
    },

    /**
     * ✅ [추가] 기존 동화 내용과 사용자 정보를 기반으로 삽화만 재생성합니다.
     * 1. 백엔드에 새로운 이미지 프롬프트 생성을 요청합니다.
     * 2. 생성된 프롬프트로 Pollinations.ai 삽화를 생성합니다.
     */
    async regenerateIllustrationOnly(story, userData) {
      // ✅ [수정] 백엔드에 삽화 재생성을 요청하면, 새로운 DALL-E 이미지 URL을 직접 반환합니다.
      const { illustrationUrl } = await fetchAPI("/stories/regenerate-prompt", {
        method: "POST",
        body: JSON.stringify({ story, userData }),
      });
      return illustrationUrl;
    },

    // --- TTS API ---
    /**
     * ✅ [추가] 텍스트를 음성으로 변환하는 API를 호출하고 오디오 Blob을 반환합니다.
     */
    async synthesizeSpeech(text, voice, language) {
      return fetchBlob("/tts/synthesize", {
        method: "POST",
        body: JSON.stringify({ text, voice, language }),
      });
    },

    // --- Translation API ---
    async translateText(text, to) {
        return fetchAPI("/translate/translate", {
            method: "POST",
            body: JSON.stringify({ text, to }),
        });
    },

    // --- 동영상 파일 생성 API ---
    /**
     * ✅ [추가] 동화를 실제 동영상 파일(.mp4)로 생성합니다.
     */
    async generateVideoFile(story, userData) {
      return fetchAPI("/video/generate", {
        method: "POST",
        body: JSON.stringify({ story, userData }),
        timeout: 300000, // ✅ [수정] 동영상 생성 요청의 타임아웃을 5분으로 늘립니다.
      });
    },

    /**
     * ✅ [추가] 동영상 생성 상태를 확인합니다.
     */
    async checkVideoStatus(videoId) {
      return fetchAPI(`/video/status/${videoId}`);
    },

    /**
     * ✅ [추가] 동영상 다운로드 URL을 반환합니다.
     */
    getVideoDownloadUrl(videoId) {
      return `${API_BASE_URL}/video/download/${videoId}`;
    },
  };
})();