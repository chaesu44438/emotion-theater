const { useState, useEffect, useRef, useCallback } = React;

// 안전하게 전역 참조 가져오기
const {
  emotions: EMOTIONS_GLOBAL,
  placeholderIllustration,
  speakChunked,
  pickWarmKoreanVoice,
  apiService, // ✅ 새로 추가된 API 서비스 참조
} = window;

// 컴포넌트 외부에 상수 선언
const PAGE_SIZE = 10;
const SAFE_EMOTIONS = Array.isArray(EMOTIONS_GLOBAL) ? EMOTIONS_GLOBAL : [];

function EmotionTheater () {
  // stage: curtain → login → name → category → age → emotion → comment → story → archive / admin
  const [stage, setStage] = useState("login"); // ✅ 시작을 'login'으로 변경
  const [previousStage, setPreviousStage] = useState("comment"); // ✅ '뒤로가기'를 위한 이전 단계 저장
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [showTitle, setShowTitle] = useState(false);

  const [currentUser, setCurrentUser] = useState(null); // ✅ 로그인된 사용자 정보
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // ✅ 회원가입 상태 추가
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', passwordConfirm: '' });
  const [registerError, setRegisterError] = useState('');

  const [userData, setUserData] = useState({
    name: "",
    category: "",
    age: "",
    emotion: "",
    comment: "",
    referenceImageUrl: "", // ✅ 참조 이미지 URL 상태 추가
  });

  const [generatedStory, setGeneratedStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false); // ✅ 삽화 재생성 로딩 상태

  // Translation states
  const [translatedStory, setTranslatedStory] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState("ko"); // 'ko' or 'en'
  const [translationError, setTranslationError] = useState(null);

  const [illustrationUrl, setIllustrationUrl] = useState("");
  const [showIllustration, setShowIllustration] = useState(true);
  const [imageError, setImageError] = useState(null); // "images_permission" | "images_other" | null

  // 보관함
  const [savedStories, setSavedStories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(savedStories.length / PAGE_SIZE));
  const pagedStories = savedStories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ✅ 관리자 페이지 상태
  const [userList, setUserList] = useState([]);
  const [adminError, setAdminError] = useState('');
  // ✅ [추가] 프롬프트 관리 상태
  const [prompts, setPrompts] = useState({ storyPrompt: '', imagePromptSystem: '' });
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);
  const [promptSaveStatus, setPromptSaveStatus] = useState(''); // 'success' | 'error' | ''
  // ✅ [추가] 관리자 페이지 뷰 상태 ('users' | 'prompts')
  const [adminView, setAdminView] = useState('users');

  // ✅ [수정] 동영상 생성 상태: isGeneratingVideo를 제거하고 stage로 관리합니다.
  const [currentVideoStory, setCurrentVideoStory] = useState(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0); // 현재 보고 있는 장면 인덱스

  // ✅ [추가] 동영상 완료 모달 상태
  const [showVideoCompleteModal, setShowVideoCompleteModal] = useState(false);
  const [completedVideoId, setCompletedVideoId] = useState(null);
  const [pollingVideoId, setPollingVideoId] = useState(null); // 폴링 중인 videoId


  // 커튼 애니메이션
  // ... (커튼 애니메이션 로직은 로그인 성공 후 등으로 이동 가능, 일단 생략)

  // 앱 시작 시 로그인 상태 확인
  useEffect(() => {
    // ✅ [수정] 앱 시작 시 항상 커튼 애니메이션을 먼저 보여줍니다.
    setStage("curtain");
    setTimeout(() => setCurtainOpen(true), 100);
    setTimeout(() => setShowTitle(true), 1000);

    // 애니메이션이 끝난 후 로그인 상태를 확인하고 페이지를 전환합니다.
    setTimeout(() => {
      const user = apiService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
      setStage("login"); // 로그인 페이지로 이동
    }, 2800);
  }, []);

  // 보관함 로드
  const loadStories = async () => {
    if (!currentUser) return;
    try {
      // ✅ API 서비스로 스토리 목록 가져오기 (백엔드 구현 필요)
      const stories = await apiService.getStories(); // 백엔드에서 이미 정렬해서 줌
      const sorted = stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSavedStories(sorted);
      if (currentPage > Math.ceil(stories.length / PAGE_SIZE)) setCurrentPage(1);
    } catch (e) {
      console.log("스토리 로드 오류:", e);
      // 토큰 만료 등의 경우 로그아웃 처리
      if (e.message.includes("401")) {
        apiService.logout();
        setCurrentUser(null);
        setStage("login");
      }
    }
  };
  useEffect(() => { if (currentUser) loadStories(); }, [currentUser]);

  // ✅ 관리자: 사용자 목록 로드
  const loadUserList = async () => {
    if (currentUser?.role !== 'admin') return;
    setAdminError('');
    try {
      const users = await apiService.getAllUsers();
      setUserList(users);
    } catch (e) {
      console.error("사용자 목록 로드 오류:", e);
      setAdminError('사용자 목록을 불러오는 데 실패했습니다.');
      if (e.message.includes("401") || e.message.includes("403")) {
        handleLogout(); // 인증 오류 시 로그아웃
      }
    }
  };
  // ✅ stage가 'admin'으로 바뀌면 사용자 목록을 로드합니다.
  useEffect(() => { if (stage === 'admin') loadUserList(); }, [stage]);

  // ✅ 관리자: 프롬프트 로드
  const loadPrompts = async () => {
    if (currentUser?.role !== 'admin') return;
    setPromptSaveStatus('');
    try {
      const currentPrompts = await apiService.getPrompts();
      // DB에 프롬프트가 없는 초기 상태일 경우, 기본값을 불러와 표시합니다.
      setPrompts({
        storyPrompt: currentPrompts.storyPrompt || window.DEFAULT_STORY_PROMPT || "",
        imagePromptSystem: currentPrompts.imagePromptSystem || window.DEFAULT_IMAGE_PROMPT_SYSTEM || "",
      });
    } catch (e) {
      console.error("프롬프트 로드 오류:", e);
      setAdminError('프롬프트를 불러오는 데 실패했습니다.');
    }
  };

  // ✅ adminView가 'prompts'로 바뀌면 프롬프트를 로드합니다.
  useEffect(() => { if (adminView === 'prompts') loadPrompts(); }, [adminView]);

  // ✅ [추가] 동영상 생성 상태 폴링
  useEffect(() => {
    if (!pollingVideoId) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusData = await apiService.checkVideoStatus(pollingVideoId);
        if (statusData.status === 'completed') {
          console.log('[VIDEO] 동영상 생성 완료!', statusData.videoId);
          setCompletedVideoId(statusData.videoId);
          setShowVideoCompleteModal(true);
          setPollingVideoId(null); // 폴링 중지
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('[VIDEO] 상태 확인 오류:', error);
      }
    }, 5000); // 5초마다 확인

    return () => clearInterval(pollInterval);
  }, [pollingVideoId]);


  // 엔터로 다음
  const nextIf = (cond, nextStage) => { if (cond) setStage(nextStage); };

  // 삽화 재생성
  const regenerateIllustration = async () => {
    if (isRegenerating || !generatedStory) return;
    setIsRegenerating(true);
    setImageError(null); // 이전 오류 상태 초기화
    try {
      // ✅ [수정] 삽화 재생성 시, 백엔드가 프롬프트를 다시 만들 수 있도록 동화 내용과 사용자 정보를 전달합니다.
      const newIllustrationUrl = await apiService.regenerateIllustrationOnly(generatedStory, userData);
      setIllustrationUrl(newIllustrationUrl);
    } catch (e) {
      console.error("삽화 재생성 오류:", e);
      setImageError("images_other"); // 오류 상태 설정
    } finally {
      setIsRegenerating(false);
    }
  };

  const generateStory = async () => {
    if (isGenerating) return; // ✅ 중복 클릭 방지
    setIsGenerating(true);

    // ✅ [수정] 먼저 로딩 화면이 있는 story 페이지로 이동합니다.
    setStage("story");

    try {
      // 1) ✅ 백엔드에 동화 생성을 요청합니다.
      const { story, illustrationUrl: imgUrl } = await apiService.generateStory(userData);
      setGeneratedStory(story);
      setIllustrationUrl(imgUrl || "");

      // 2) 보관 저장
      const label = (SAFE_EMOTIONS.find(e => e.id === userData.emotion)?.label) || "";
      const title = `[${label}] ${userData.comment ? userData.comment.slice(0, 24) : "오늘의 기록"}`;
      const record = {
        id: `story-${Date.now()}`, // 프론트엔드에서 임시 ID 생성
        ...userData,
        story,
        title,
        illustrationUrl: imgUrl || "", // referenceImageUrl은 보관 데이터에 포함됩니다.
      };

      // ✅ [수정] API 서비스를 통해 스토리를 저장하고, DB에 저장된 최종 데이터를 받습니다.
      const savedRecord = await apiService.saveStory(record);
      await loadStories(); // ✅ [추가] 저장 후 보관함 목록을 즉시 갱신합니다.

    } catch (e) {
      console.error("동화 생성 실패:", e);

      // ✅ 더 자세한 에러 메시지 추출
      let errorDetails = "서버 로그를 확인해주세요.";
      if (e.response?.data?.message) {
        errorDetails = e.response.data.message;
      } else if (e.message) {
        errorDetails = e.message;
      }

      // 추가 상세 정보가 있으면 콘솔에 출력
      if (e.response?.data?.details) {
        console.error("에러 상세:", e.response.data.details);
      }

      const label = (SAFE_EMOTIONS.find(x => x.id === userData.emotion)?.label) || "감정";
      setGeneratedStory(
        `${userData.name}${userData.category === "child" ? "이" : "님"}의 오늘(${label}) 이야기를 준비하고 있어요.\n\n` +
        `코멘트: ${userData.comment || "(없음)"}\n\n` +
        `❌ 동화 생성에 실패했습니다.\n` +
        `오류: ${errorDetails}\n\n` +
        `해결 방법:\n` +
        `- 입력 내용을 확인해주세요 (특정 단어가 필터링될 수 있습니다)\n` +
        `- 잠시 후 다시 시도해주세요\n` +
        `- 문제가 계속되면 관리자에게 문의하세요`
      );
      setIllustrationUrl("");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslate = async () => {
    if (isTranslating || !generatedStory) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      // Note: The backend expects the 'to' language code. 'en' for English.
      const { translation } = await apiService.translateText(generatedStory, 'en');
      setTranslatedStory(translation);
      setCurrentLanguage('en');
    } catch (error) {
      console.error("Translation error:", error);
      setTranslationError("번역에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsTranslating(false);
    }
  };

  const switchToKorean = () => {
    setCurrentLanguage('ko');
    setTranslationError(null);
  };

  const openFromList = (it) => {
    setUserData({
      name: it.name, category: it.category, age: it.age,
      emotion: it.emotion, comment: it.comment, referenceImageUrl: it.referenceImageUrl || ""
    });
    setGeneratedStory(it.story);
    setIllustrationUrl(it.illustrationUrl);
    setShowIllustration(true);
    // Reset translation state when opening a story
    setTranslatedStory("");
    setCurrentLanguage("ko");
    setTranslationError(null);
    setStage("story");
  };

  const deleteFromList = async (it) => {
    if (!it.id) return; // DB id가 없으면 삭제 불가
    if (confirm(`'${it.title}' 이야기를 정말로 삭제하시겠어요?`)) {
      await apiService.deleteStory(it.id);
      await loadStories(); // 목록 다시 로드
    }
  };

 // ── TTS 상태 ─────────────────────────────────────────
const [voicePref, setVoicePref] = useState("female");
const audioRef = useRef(null); // ✅ Audio 객체를 저장할 ref
const [speaking, setSpeaking] = useState(false);
const [isPaused, setIsPaused] = useState(false); // ✅ 일시정지 상태
const [lipImage, setLipImage] = useState('lip1.png');
const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

// ── 배경음악 상태 ─────────────────────────────────────────
const bgmAudioRef = useRef(null); // ✅ 배경음악 Audio 객체
const [bgmEnabled, setBgmEnabled] = useState(true); // ✅ 배경음악 on/off
const [bgmVolume, setBgmVolume] = useState(0.3); // ✅ 배경음악 볼륨 (0.0 ~ 1.0)

// 컴포넌트가 언마운트될 때 오디오 정지 및 리소스 해제
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current = null;
    }
  };
}, []);

// ✅ 배경음악 초기화 및 재생
useEffect(() => {
  if (!bgmAudioRef.current) {
    const bgm = new Audio('music/마음극장_메인브금.mp3');
    bgm.loop = true; // 반복 재생
    bgm.volume = bgmVolume;
    bgmAudioRef.current = bgm;
  }

  // curtain stage에서 배경음악 시작
  if (stage === "curtain" && bgmEnabled && bgmAudioRef.current) {
    bgmAudioRef.current.play().catch(err => {
      console.log("배경음악 자동재생 차단:", err);
      // 브라우저에서 자동재생이 차단된 경우, 사용자 상호작용 후 재생
    });
  }
}, [stage]);

// ✅ 배경음악 on/off 제어
useEffect(() => {
  if (bgmAudioRef.current) {
    if (bgmEnabled) {
      bgmAudioRef.current.play().catch(err => console.log("배경음악 재생 오류:", err));
    } else {
      bgmAudioRef.current.pause();
    }
  }
}, [bgmEnabled]);

// ✅ 배경음악 볼륨 조절
useEffect(() => {
  if (bgmAudioRef.current) {
    bgmAudioRef.current.volume = bgmVolume;
  }
}, [bgmVolume]);

// 마우스 위치 추적
useEffect(() => {
  const handleMouseMove = (event) => {
    setCursorPos({ x: event.clientX, y: event.clientY });    
  };
  window.addEventListener('mousemove', handleMouseMove);     
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
  };
}, []);

// 입술 애니메이션 효과
useEffect(() => {
  let lipAnimation;
  if (speaking) {
    let isLip1 = true;
    lipAnimation = setInterval(() => {
      setLipImage(isLip1 ? 'lip1.png' : 'lip2.png');
      isLip1 = !isLip1;
    }, 200);
  }

  return () => {
    if (lipAnimation) {
      clearInterval(lipAnimation);
    }
  };
}, [speaking]);

// `speaking` 상태에 따라 body 커서 스타일 변경
useEffect(() => {
  if (speaking) {
    document.body.style.cursor = 'none'; // 음성 재생 중에는 기본 커서 숨기기
  } else {
    document.body.style.cursor = 'default'; // 음성 재생이 끝나면 기본 커서로 복원
  }
  // 컴포넌트 언마운트 시 또는 speaking 상태가 변경될 때 커서 스타일을 원래대로 복원
  return () => {
    document.body.style.cursor = 'default';
  };
}, [speaking]);

const speakStory = async () => {
  const text = currentLanguage === 'en' ? translatedStory : generatedStory;
  if (!text.trim() || speaking) return;

  setSpeaking(true);
  setIsPaused(false);

  const originalBgmVolume = bgmVolume;
  if (bgmAudioRef.current && bgmEnabled) {
    bgmAudioRef.current.volume = 0.05;
  }

  try {
    const audioBlob = await apiService.synthesizeSpeech(text, voicePref, currentLanguage);
    if (!audioBlob) {
      throw new Error("TTS API로부터 오디오 데이터를 받지 못했습니다.");
    }
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.play();

    audio.onended = () => {
      setSpeaking(false);
      setIsPaused(false);
      URL.revokeObjectURL(audioUrl);
      if (bgmAudioRef.current && bgmEnabled) {
        bgmAudioRef.current.volume = originalBgmVolume;
      }
    };
    audio.onerror = (e) => {
      console.error("오디오 재생 오류:", e);
      setSpeaking(false);
      setIsPaused(false);
      URL.revokeObjectURL(audioUrl);
      if (bgmAudioRef.current && bgmEnabled) {
        bgmAudioRef.current.volume = originalBgmVolume;
      }
      alert("음성을 재생하는 중 오류가 발생했습니다.");
    }
  } catch (error) {
    console.error("speakStory 함수 오류:", error);
    setSpeaking(false);
    setIsPaused(false);
    if (bgmAudioRef.current && bgmEnabled) {
      bgmAudioRef.current.volume = originalBgmVolume;
    }
    alert("음성 생성 중 오류가 발생했습니다.");
  }
};

// ✅ 일시정지 - 현재 위치 유지
const pauseTTS = () => {
  if (audioRef.current && !audioRef.current.paused) {
    audioRef.current.pause();
    setSpeaking(false);
    setIsPaused(true); // ✅ 일시정지 상태로 전환
  }
};

// ✅ 다시 시작 - 멈췄던 위치부터 재생
const resumeTTS = () => {
  if (audioRef.current && isPaused) {
    audioRef.current.play();
    setSpeaking(true);
    setIsPaused(false); // ✅ 재생 상태로 전환

    // ✅ 배경음악 볼륨 다시 줄이기
    if (bgmAudioRef.current && bgmEnabled) {
      bgmAudioRef.current.volume = 0.05;
    }
  }
};

// ✅ 정지 - 처음으로 되감기
const stopTTS = () => {
  if (audioRef.current) {
    audioRef.current.pause(); // 재생 중지
    audioRef.current.currentTime = 0; // 처음으로 되감기
  }
  setSpeaking(false);
  setIsPaused(false); // ✅ 일시정지 상태도 해제
  // ✅ TTS 정지 시 배경음악 볼륨 복구
  if (bgmAudioRef.current && bgmEnabled) {
    bgmAudioRef.current.volume = bgmVolume;
  }
};

  // ✅ 로그인 핸들러
  const handleLogin = async () => {
    setLoginError('');
    try {
      // ✅ [수정] 로그인 시 role 정보도 함께 받아옵니다.
      const { role } = await apiService.login(loginForm.username, loginForm.password);
      const user = apiService.getCurrentUser();
      // 로그인 성공 후 상태 업데이트
      setCurrentUser(user);
      setLoginForm({ username: '', password: '' }); // 로그인 폼 초기화

      // ✅ [수정] 사용자가 관리자인 경우 관리자 페이지로, 아니면 일반 플로우로 이동합니다.
      if (role === 'admin') {
        setStage('admin');
      } else {
        setStage('name');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError('사용자 이름 또는 비밀번호가 올바르지 않습니다.');
      apiService.logout();
      setCurrentUser(null);
    }
  };

  // ✅ 로그아웃 핸들러
  const handleLogout = () => {
    apiService.logout();

    // ✅ [수정] 모든 세션 관련 상태를 초기화합니다.
    setCurrentUser(null);
    setUserData({
      name: "",
      category: "",
      age: "",
      emotion: "",
      comment: "",
      referenceImageUrl: "",
    });
    setGeneratedStory("");
    setIllustrationUrl("");
    // setSavedStories([]); // 보관함 목록은 다음 로그인 시 다시 로드되므로 클라이언트에서 초기화하지 않습니다.
    setLoginError('');
    setRegisterError('');

    setStage('login');
  };

  // ✅ 회원가입 핸들러
  const handleRegister = async () => {
    setRegisterError('');
    if (registerForm.password !== registerForm.passwordConfirm) {
      setRegisterError('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await apiService.register(registerForm.username, registerForm.password);
      alert('회원가입에 성공했습니다! 이제 로그인해주세요.');
      // 상태 초기화 및 로그인 화면으로 전환
      setIsRegistering(false);
      setRegisterForm({ username: '', password: '', passwordConfirm: '' });
      setRegisterError('');
      setStage('login');
    } catch (error) {
      console.error('Registration failed:', error);
      // 백엔드에서 오는 에러 메시지 표시
      const message = error.message.includes('409') ? '이미 사용 중인 사용자 이름입니다.' : '회원가입 중 오류가 발생했습니다.';
      setRegisterError(message);
    }
  };

  // ✅ 관리자: 사용자 삭제 핸들러
  const handleDeleteUser = async (userId, username) => {
    if (confirm(`'${username}' 사용자를 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      await apiService.deleteUser(userId);
      // 삭제 성공 후 목록을 다시 로드합니다.
      await loadUserList();
    }
  };

  // ✅ 관리자: 프롬프트 저장 핸들러
  const handleSavePrompts = async () => {
    setIsSavingPrompts(true);
    setPromptSaveStatus('');
    try {
      await apiService.updatePrompts(prompts.storyPrompt, prompts.imagePromptSystem);
      setPromptSaveStatus('success');
      // 3초 후 성공 메시지 숨기기
      setTimeout(() => setPromptSaveStatus(''), 3000);
    } catch (error) {
      console.error("프롬프트 저장 오류:", error);
      setPromptSaveStatus('error');
      setAdminError('프롬프트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // ✅ 동영상 파일 생성 및 다운로드 핸들러
  // ✅ [수정] useCallback으로 함수가 불필요하게 재생성되는 것을 방지하여 비동기 작업 후의 상태 일관성을 유지합니다.
  const handleGenerateVideo = useCallback(async (story) => {
    // ✅ [수정] 확인 창 없이 바로 로딩 페이지로 전환합니다.
    setStage('videoGenerating');
    setCurrentVideoStory(story);

    try {
      // API 호출은 백그라운드에서 실행됩니다.
      // ✅ [수정] story 객체에서 필요한 모든 사용자 정보를 userData로 전달합니다.
      // ✅ [수정] 비동기 생성 요청만 보내고, 자동 다운로드는 하지 않습니다.
      const response = await apiService.generateVideoFile(story.story, { ...story, voicePref });

      console.log("[VIDEO] 동영상 생성 요청 성공! 작업이 백그라운드에서 시작됩니다.");
      console.log("[VIDEO] 받은 videoId:", response.videoId);

      // ✅ [추가] 폴링 시작
      setPollingVideoId(response.videoId);

    } catch (error) {
      console.error("동영상 생성 오류:", error);

      // ✅ [수정] 오류 발생 시 알림창 대신, 로딩 페이지에 오류 메시지를 표시합니다.
      if (error.message.includes("시간이 초과") || error.message.includes("Failed to fetch")) {
        console.log("동영상 생성 요청 시간이 초과되었습니다. 백그라운드에서 계속 진행됩니다.");
      } else {
        // 로딩 페이지에 오류 메시지를 표시하기 위해 상태를 업데이트합니다.
        setCurrentVideoStory(s => ({ ...s, error: "동영상 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }));
      }
    }
  }, [voicePref]); // ✅ 의존성 배열: voicePref 값이 바뀔 때만 함수를 새로 만듭니다.

  // ✅ [추가] 로딩 상태에 따라 배경 이미지를 동적으로 결정합니다.
  const isLoading = isGenerating || stage === "videoGenerating";
  const backgroundImageUrl = isLoading ? "url('poster.jpg')" : "url('Background.png')";


  return (
    // ✅ [수정] 로딩 상태에 따라 배경 이미지를 동적으로 설정합니다.
    <div className="paper-texture min-h-screen bg-[#FBF9F4] text-[#4B382B] flex items-center justify-center p-4" style={{ backgroundImage: backgroundImageUrl, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 0.5s ease-in-out' }}>

      {speaking && (
        <img
          src={lipImage}
          alt="lip cursor"
          style={{
            position: 'fixed',
            left: cursorPos.x,
            top: cursorPos.y,
            width: '50px', // 커서 크기 조절
            height: 'auto',
            transform: 'translate(-50%, -50%)', // 커서의 중심으로 위치 맞춤       
            pointerEvents: 'none', // 이미지가 마우스 이벤트를 방해하지 않도록 설정
            zIndex: 9999,
          }}
        />
      )}

      {/* ✅ 배경음악 컨트롤 (우측 하단 고정) - 아이콘만 표시 */}
      {stage !== "curtain" && (
        <button
          onClick={() => setBgmEnabled(!bgmEnabled)}
          className={`fixed bottom-4 right-4 z-20 w-10 h-10 rounded-full shadow-lg border-2 transition-all flex items-center justify-center ${
            bgmEnabled
              ? 'bg-green-100 text-green-800 border-green-400 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
          }`}
          title={bgmEnabled ? '배경음악 끄기' : '배경음악 켜기'}
        >
          <span className="text-lg">{bgmEnabled ? '🔊' : '🔇'}</span>
        </button>
      )}

        {/* 커튼 */}
        {stage === "curtain" && (
          <div className="fixed inset-0 flex items-center justify-center overflow-hidden z-30" style={{ backgroundImage: "url('poster.jpg')", backgroundSize: 'cover', backgroundPosition: 'top', backgroundAttachment: 'fixed' }}>
            <div className="absolute inset-0 flex">
              <div className={`w-1/2 bg-gradient-to-r from-red-800 to-red-600 transition-transform duration-[1800ms] ${curtainOpen ? "-translate-x-full" : ""} curtain-shadow-left`}/>
              <div className={`w-1/2 bg-gradient-to-l from-red-800 to-red-600 transition-transform duration-[1800ms] ${curtainOpen ? "translate-x-full" : ""} curtain-shadow-right`}/>
            </div>
            <div className={`relative z-10 text-center text-white transition-opacity duration-1000 ${showTitle ? 'opacity-100' : 'opacity-0'}`}>
            <h1 className="text-6xl font-bold mb-2 golden-title">마음극장</h1>
            <p className="text-2xl text-[#A27621] golden-title" style={{ textShadow: "0 0 5px #D9A746" }}>Theater of Emotions</p>
            </div>
          </div>
        )}

        {/* ✅ 로그인 또는 회원가입 */}
        {stage === "login" && !isRegistering && (
          <div key="login" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">마음극장 로그인</h2>
              <p className="text-gray-600">계정 정보를 입력하세요.</p>
            </div>
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              placeholder="사용자 이름"
              className="w-full px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-400 text-center text-xl focus:border-yellow-400 transition-all"
              autoFocus
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="비밀번호"
              className="w-full mt-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-400 text-center text-xl focus:border-yellow-400 transition-all"
            />
            {loginError && (
              <p className="text-red-500 text-sm text-center mt-3">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={!loginForm.username || !loginForm.password}
              className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-yellow-400 to-pink-400 text-white rounded-xl font-bold text-xl hover:from-yellow-500 hover:to-pink-500 disabled:opacity-50 transition-all shadow-lg"
            >
              로그인
            </button>
            <p className="text-center text-sm text-gray-600 mt-4">
              계정이 없으신가요? <button onClick={() => setIsRegistering(true)} className="font-bold text-yellow-600 hover:underline">회원가입</button>
            </p>
          </div>
        )}

        {/* ✅ 회원가입 UI */}
        {stage === "login" && isRegistering && (
          <div key="register" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">회원가입</h2>
              <p className="text-gray-600">새로운 계정을 만듭니다.</p>
            </div>
            <input
              type="text"
              value={registerForm.username}
              onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
              placeholder="사용자 이름"
              className="w-full px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-center text-xl focus:border-yellow-400"
              autoFocus
            />
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              placeholder="비밀번호"
              className="w-full mt-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-center text-xl focus:border-yellow-400"
            />
            <input
              type="password"
              value={registerForm.passwordConfirm}
              onChange={(e) => setRegisterForm({ ...registerForm, passwordConfirm: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              placeholder="비밀번호 확인"
              className="w-full mt-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-center text-xl focus:border-yellow-400"
            />
            {registerError && (
              <p className="text-red-500 text-sm text-center mt-3">{registerError}</p>
            )}
            <button
              onClick={handleRegister}
              disabled={!registerForm.username || !registerForm.password || !registerForm.passwordConfirm}
              className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-green-400 to-blue-400 text-white rounded-xl font-bold text-xl hover:from-green-500 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg"
            >
              가입하기
            </button>
            <p className="text-center text-sm text-gray-600 mt-4">
              이미 계정이 있으신가요? <button onClick={() => setIsRegistering(false)} className="font-bold text-yellow-600 hover:underline">로그인</button>
            </p>
          </div>
        )}

        {/* ✅ 주인공 이름 입력 */}
        {stage === "name" && (
          <div key="name" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            <button onClick={handleLogout} className="absolute top-4 right-4 text-sm text-gray-600 hover:text-red-600 font-semibold">로그아웃</button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">주인공 이름은?</h2>
              <p className="text-gray-600">동화에 등장할 주인공의 이름을 알려주세요.</p>
            </div>
            <input
              type="text"
              value={userData.name}
              onChange={(e) => setUserData({ ...userData, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && nextIf(userData.name, "category")}
              placeholder="주인공 이름"
              className="w-full px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-400 text-center text-xl focus:border-yellow-400 transition-all"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setPreviousStage(stage); setStage("archive"); }}
                className="px-4 py-4 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all"
              >
                📄 보관함
              </button>
              <button
                onClick={() => nextIf(userData.name, "category")}
                disabled={!userData.name}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-yellow-400 to-pink-400 text-white rounded-xl font-bold text-xl hover:from-yellow-500 hover:to-pink-500 disabled:opacity-50 transition-all shadow-lg"
              >
                다음으로
              </button>
            </div>
          </div>
        )}

        {/* 유형 */}
        {stage === "category" && (
          <div key="category" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            <button onClick={() => setStage("name")} className="mb-4 text-gray-700 hover:text-yellow-600">← 뒤로가기</button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">{userData.name}님을 위한</h2>
              <p className="text-gray-600">동화 유형을 선택해주세요</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setUserData({ ...userData, category: "child" }); setStage("age"); }}
                className="p-8 bg-gradient-to-br from-blue-200 to-teal-200 rounded-2xl hover:scale-105 transition-transform shadow text-gray-900 font-bold"
              >어린이</button>
              <button
                onClick={() => { setUserData({ ...userData, category: "adult" }); setStage("age"); }}
                className="p-8 bg-gradient-to-br from-purple-200 to-pink-200 rounded-2xl hover:scale-105 transition-transform shadow text-gray-900 font-bold"
              >어른</button>
            </div>
          </div>
        )}

        {/* 나이 */}
        {stage === "age" && (
          <div key="age" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            <button onClick={() => setStage("category")} className="mb-4 text-gray-700 hover:text-yellow-600">← 뒤로가기</button>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">나이를 알려주세요</h2>
            </div>
            <input
              type="number"
              value={userData.age}
              onChange={(e) => setUserData({ ...userData, age: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && nextIf(userData.age, "emotion")}
              placeholder="나이를 입력하세요"
              className="w-full px-6 py-4 rounded-xl bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-400 text-center text-xl focus:border-yellow-400 transition-all"
              autoFocus
            />
            <button
              onClick={() => nextIf(userData.age, "emotion")}
              disabled={!userData.age}
              className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-yellow-400 to-pink-400 text-white rounded-xl font-bold text-xl hover:from-yellow-500 hover:to-pink-500 disabled:opacity-50 transition-all shadow-lg"
            >
              다음으로
            </button>
          </div>
        )}

        {/* 감정 */}
        {stage === "emotion" && (
          <div key="emotion" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            <button onClick={() => setStage("age")} className="mb-4 text-gray-700 hover:text-yellow-600">← 뒤로가기</button>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">오늘의 감정은?</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SAFE_EMOTIONS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setUserData({ ...userData, emotion: e.id }); setStage("comment"); }}
                  className={`py-5 rounded-2xl font-bold ${e.tone} transition transform hover:scale-[1.02] border border-white/40`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 코멘트 + 보관함 */}
        {stage === "comment" && (
            <div key="comment" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
                <button onClick={() => setStage("emotion")} className="mb-4 text-gray-700 hover:text-yellow-600">
                ← 뒤로가기
                </button>

                <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">관련 코멘트</h2>
                <p className="text-gray-600">동화에 살짝 녹일 한두 문장을 적어주세요</p>
                <p className="text-gray-600">동화구현에 1~2분 소요됩니다.</p>
                </div>

                <input
                type="text"
                value={userData.comment}
                onChange={(e) => setUserData({ ...userData, comment: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && generateStory()}
                placeholder="예: 오늘은 유난히 바람 냄새가 좋았어"
                className="w-full px-6 py-4 rounded-xl bg-white border-2 border-yellow-300 text-gray-900 placeholder-gray-400 text-center focus:border-yellow-400 transition-all"
                autoFocus
                />
                
                {/* ✅ [수정] 참조 이미지 업로드 및 취소 UI */}
                <div className="mt-4">
                {userData.referenceImageUrl ? (
                    <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">참조 이미지:</p>
                    <div className="relative inline-block">
                        <img
                        src={userData.referenceImageUrl}
                        alt="참조 이미지 미리보기"
                        className="mx-auto max-h-24 rounded-lg border border-gray-300"
                        />
                        <button onClick={() => setUserData({ ...userData, referenceImageUrl: "" })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white"
                        title="선택 취소">
                          X
                        </button>
                    </div>
                    </div>
                ) : (
                    <label htmlFor="reference-image-upload" className="w-full cursor-pointer px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                      🖼️ (선택) 참조 이미지 업로드
                    </label>
                  )}
                  {/* ✅ [수정] onChange 이벤트 후 입력 값을 초기화하여 동일 파일 재선택 문제 해결 */}
                  <input id="reference-image-upload" type="file" accept="image/jpeg, image/png, image/gif" className="hidden" onChange={(e) => { 
                    const file = e.target.files[0]; 
                    if (!file) return; 

                    // ✅ [추가] 이미지 크기 제한 (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      alert("이미지 크기가 5MB를 초과합니다.");
                      e.target.value = null; // 파일 선택 초기화
                      return;
                    }

                    const reader = new FileReader(); 
                    reader.onload = (loadEvent) => { 
                      setUserData({ ...userData, referenceImageUrl: loadEvent.target.result }); 
                    }; 
                    reader.readAsDataURL(file); 
                    e.target.value = null; // ✅ 파일 선택 후 입력 필드 초기화


                  }}/>
                </div>

                <div className="flex gap-3 mt-4">
                <button
                    onClick={generateStory}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-yellow-400 to-pink-400 text-white rounded-xl font-bold text-xl hover:from-yellow-500 hover:to-pink-500 transition-all shadow-lg"
                >
                    동화 만들기 ✨
                </button>

                </div>

                <button
                onClick={() => {
                    setUserData({ ...userData, comment: "" });
                    generateStory();
                }}
                className="w-full mt-3 px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all"
                >
                코멘트 없이 만들기
                </button>
            </div>
            )}

        {/* 동화 보기 + 삽화 + TTS */}
        {stage === "story" && (
          <div key="story" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            {/* ✅ [수정] 뒤로가기 버튼 클릭 시 이름 입력 단계로 이동하고, 참조 이미지 등 일부 상태를 초기화합니다. */}
            <button onClick={() => {
                stopTTS(); // TTS 정지
                // 다음 동화 만들기를 위해 일부 상태 초기화 (이름, 나이, 유형은 유지)
                setUserData(u => ({
                  ...u,
                  emotion: "",
                  comment: "",
                  referenceImageUrl: "", // 참조 이미지 URL 초기화
                }));
                setGeneratedStory("");
                setIllustrationUrl("");
                setImageError(null);
                // Reset translation state
                setTranslatedStory("");
                setCurrentLanguage("ko");
                setTranslationError(null);
                setStage("name"); // 이름 입력 단계로 이동
              }} className="mb-4 text-gray-700 hover:text-yellow-600">← 뒤로가기</button>

            {isGenerating ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 animate-spin">✨</div>
                <p className="text-gray-700 text-xl">동화를 만들고 있어요...</p>
              </div>
            ) : (
              <>
                {imageError === "images_permission" && (
                  <div className="mb-3 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2">
                    이미지 모델(gpt-image-1) 사용 권한이 없는 API 키입니다. 대시보드에서 결제/조직 인증 후 다시 시도해주세요.
                  </div>
                )}

                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold mb-1">
                    {userData.name}{userData.category === "child" ? "이" : "님"}의 이야기
                  </h2>
                  <p className="text-gray-700">
                    {(SAFE_EMOTIONS.find((e) => e.id === userData.emotion)?.label) || "감정"} 동화
                  </p>
                </div>

                {(illustrationUrl || isGenerating || imageError) && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">이야기 삽화</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowIllustration(v => !v)}
                          className="text-xs px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                        >
                          {showIllustration ? "접기" : "펴기"}
                        </button>
                        <button
                          onClick={regenerateIllustration}
                          disabled={isRegenerating || imageError === "images_permission"}
                          className={`text-xs px-3 py-1 rounded-lg border transition-all ${isRegenerating ? "opacity-50 cursor-wait border-gray-200 bg-gray-100" : imageError === "images_permission" ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-100" : "border-pink-300 bg-pink-100 hover:bg-pink-200"}`}
                          title={isRegenerating ? "생성 중..." : "키워드+감정 기반으로 다시 생성"}
                        >
                          삽화 다시 만들기
                        </button>
                      </div>
                    </div>

                    {showIllustration ? (
                      isRegenerating ? (
                        <div className="w-full aspect-[3/2] rounded-xl border border-gray-300 bg-gray-50 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin" />
                        </div>
                      ) :
                      (illustrationUrl ? (
                        <img
                          src={illustrationUrl}
                          alt="이야기 삽화"
                          className="w-full aspect-[3/2] object-cover rounded-xl border border-gray-300 shadow-sm"
                          draggable="false"
                        />
                      ) : (
                        <img
                          src={placeholderIllustration(
                            (SAFE_EMOTIONS.find(e=>e.id===userData.emotion)?.label)||"동화",
                            userData.emotion
                          )}
                          alt="플레이스홀더"
                          className="w-full aspect-[3/2] object-cover rounded-xl border border-dashed border-gray-300"
                          draggable="false"
                        />
                      ))
                    ) : null}
                  </div>
                )}

                {/* 보이스 선택 & 언어 전환 */}
                <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">TTS 목소리</label>
                        <select
                            value={voicePref}
                            onChange={(e) => setVoicePref(e.target.value)}
                            className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                        >
                            <option value="female">여성(온화)</option>
                            <option value="male">남성(온화)</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentLanguage === 'ko' ? (
                            <button onClick={handleTranslate} disabled={isTranslating} className="text-sm px-3 py-1 rounded-lg border border-blue-300 bg-blue-100 hover:bg-blue-200 disabled:opacity-50">
                                {isTranslating ? "번역 중..." : "영문 변환"}
                            </button>
                        ) : (
                            <button onClick={switchToKorean} className="text-sm px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-100">
                                원문 보기
                            </button>
                        )}
                    </div>
                </div>


                {/* ✅ [수정] 재생/일시정지/다시시작/처음부터 버튼 */}
                <div className="flex gap-2 justify-center mb-4">
                  {speaking ? (
                    // 재생 중: 일시정지 버튼
                    <button onClick={pauseTTS} className="w-full px-4 py-3 rounded-lg bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 font-semibold">
                      ⏸ 일시정지
                    </button>
                  ) : isPaused ? (
                    // 일시정지 상태: 다시 시작 + 처음부터 버튼
                    <>
                      <button onClick={resumeTTS} className="flex-1 px-4 py-3 rounded-lg bg-green-200 hover:bg-green-300 border border-green-400 font-semibold">
                        ▶ 다시 시작
                      </button>
                      <button onClick={stopTTS} className="flex-1 px-4 py-3 rounded-lg bg-blue-200 hover:bg-blue-300 border border-blue-400 font-semibold">
                        ⏮ 처음부터
                      </button>
                    </>
                  ) : (
                    // 정지 상태: 처음부터 재생 버튼
                    <button onClick={speakStory} className="w-full px-4 py-3 rounded-lg bg-pink-200 hover:bg-pink-300 border border-pink-300 font-semibold">
                      ▶ 처음부터 재생
                    </button>
                  )}
                </div>

                {translationError && <p className="text-red-500 text-sm text-center mb-2">{translationError}</p>}

                <div className="bg-white rounded-2xl p-6 mb-6 max-h-96 overflow-y-auto border border-gray-300">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-line">
                    {currentLanguage === 'en' ? translatedStory : generatedStory}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                        stopTTS();
                        setUserData(u => ({
                            ...u,
                            emotion: "",
                            comment: "",
                            referenceImageUrl: "", // ✅ 참조 이미지 URL 초기화
                          }));
                      
                          // 생성 결과/이미지 상태 초기화
                          setGeneratedStory("");
                          setIllustrationUrl("");
                          setImageError(null);
                          // Reset translation state
                          setTranslatedStory("");
                          setCurrentLanguage("ko");
                          setTranslationError(null);
                      
                          // ✅ 바로 감정선택 화면으로
                          setStage("emotion");
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 to-pink-400 text-white rounded-xl font-bold hover:from-yellow-500 hover:to-pink-500 transition-all shadow-lg"
                  >
                    새 동화 만들기
                  </button>
                </div>
                <button onClick={() => setStage("archive")} className="w-full mt-3 px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all">
                  📄 보관함으로 이동
                </button>
              </>
            )}
          </div>
        )}

                    {/* 보관함 */}
            {stage === "archive" && (
            <div key="archive" className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-300 relative w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"> {/* ✅ 뒤로가기 버튼은 이전 stage에 따라 동적으로 동작해야 함 */}
                    <button onClick={() => setStage(previousStage)} className="text-gray-700 hover:text-yellow-600">← 뒤로가기</button>
                    <h2 className="text-2xl font-bold text-gray-900 ml-2">이야기 보관함</h2>
                </div>

            
                </div>

            {savedStories.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-3">📄</div>
                저장된 동화가 없어요
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-200 bg-white rounded-2xl border border-gray-200">
                  {pagedStories.map((it) => (
                    <li key={it.id} className="p-3 flex items-center gap-3">
                      {it.illustrationUrl ? (
                        <img src={it.illustrationUrl} alt="" className="w-10 h-10 rounded-md object-cover border" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-gray-100 border flex items-center justify-center text-gray-400 text-lg">🖼️</div>
                      )}
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 line-clamp-1 text-base">{it.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(it.createdAt).toLocaleString()} · {it.name} · {it.age}세 · {(SAFE_EMOTIONS.find(e=>e.id===it.emotion)?.label)||"감정"}
                        </div>
                      </div>
                      <button
                        onClick={() => openFromList(it)}
                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-base"
                        title="이야기 열기"
                      >
                        📖
                      </button>
                      <button
                        onClick={() => handleGenerateVideo(it)}
                        className="px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-base"
                        title="동영상 만들기"
                      >
                        🎬
                      </button>
                      <button
                        onClick={() => deleteFromList(it)}
                        className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-base"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border rounded-lg bg-white disabled:opacity-50 text-sm"
                  >
                    ← 이전
                  </button>
                  <span className="text-sm text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border rounded-lg bg-white disabled:opacity-50 text-sm"
                  >
                    다음 →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ✅ [추가] 동영상 생성 로딩 페이지 */}
        {stage === "videoGenerating" && (
          <div key="videoGenerating" className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-300 relative w-full max-w-md">
            {currentVideoStory?.error ? (
              <div className="text-center">
                <div className="text-5xl mb-4">😢</div>
                <h2 className="text-2xl font-bold mb-2">오류 발생</h2>
                <p className="text-gray-600">{currentVideoStory.error}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-6 w-16 h-16 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin" />
                <h2 className="text-2xl font-bold mb-2">🎬 동영상 파일을 생성하고 있어요...</h2>
                <div className="text-gray-600 text-base space-y-1 mb-4">
                  <p>• 동화를 4개 장면으로 분할</p>
                  <p>• 각 장면별 삽화 생성 및 음성 합성</p>
                  <p>• 동영상 파일로 최종 결합</p>
                </div>
                <p className="text-gray-500 text-sm mt-4">약 2~5분 소요됩니다. 작업은 백그라운드에서 계속 진행됩니다.</p>
              </div>
            )}
            <button
              // ✅ [수정] 보관함으로 돌아갈 때, 비디오 생성 상태를 초기화하여 배경이 원래대로 돌아오도록 합니다.
              onClick={() => {
                setStage('archive');
                setCurrentVideoStory(null); // 비디오 생성 상태 초기화
              }}
              className="w-full mt-6 px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all"
            >
              📄 보관함으로 돌아가기
            </button>
          </div>
        )}

        {/* ✅ 관리자 페이지 */}
        {stage === "admin" && (
          <div key="admin" className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-300 relative w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">관리자 페이지</h2>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all text-sm">
                로그아웃
              </button>
            </div>

            {adminError && (
              <p className="text-red-500 text-sm text-center mb-3">{adminError}</p>
            )}

            {/* ✅ [추가] 관리 페이지 선택 탭 */}
            <div className="flex border-b border-gray-300 mb-4">
              <button
                onClick={() => setAdminView('users')}
                className={`px-4 py-2 text-lg font-semibold transition-colors ${adminView === 'users' ? 'border-b-2 border-yellow-500 text-gray-900' : 'text-gray-500 hover:bg-gray-100 rounded-t-md'}`}
              >
                사용자 관리
              </button>
              <button
                onClick={() => setAdminView('prompts')}
                className={`px-4 py-2 text-lg font-semibold transition-colors ${adminView === 'prompts' ? 'border-b-2 border-yellow-500 text-gray-900' : 'text-gray-500 hover:bg-gray-100 rounded-t-md'}`}
              >
                프롬프트 관리
              </button>
            </div>

            {/* ✅ [수정] 'users' 뷰일 때만 사용자 관리 섹션 표시 */}
            {adminView === 'users' && (
              <div>
                <h3 className="text-xl font-semibold mb-2">사용자 목록</h3>
                <div className="max-h-96 overflow-y-auto bg-white rounded-2xl border border-gray-200">
                  <ul className="divide-y divide-gray-200">
                    {userList.map((user) => (
                      <li key={user.id} className="p-4 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">
                            {user.username}
                            {user.role === 'admin' && <span className="ml-2 text-xs font-semibold bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Admin</span>}
                          </div>
                          <div className="text-sm text-gray-500">
                            가입일: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-sm"
                          >
                            삭제
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ✅ [수정] 'prompts' 뷰일 때만 프롬프트 관리 섹션 표시 */}
            {adminView === 'prompts' && (
              <div>
                <h3 className="text-xl font-semibold mb-2">프롬프트 수정</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="storyPrompt" className="block text-sm font-medium text-gray-700 mb-1">동화 생성 프롬프트</label>
                    <textarea id="storyPrompt" rows="8" value={prompts.storyPrompt} onChange={(e) => setPrompts(p => ({ ...p, storyPrompt: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500"></textarea>
                  </div>
                  <div>
                    <label htmlFor="imagePromptSystem" className="block text-sm font-medium text-gray-700 mb-1">삽화 생성 프롬프트 (System Role)</label>
                    <textarea id="imagePromptSystem" rows="8" value={prompts.imagePromptSystem} onChange={(e) => setPrompts(p => ({ ...p, imagePromptSystem: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500"></textarea>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-4">
                  {promptSaveStatus === 'success' && <span className="text-sm text-green-600">성공적으로 저장되었습니다!</span>}
                  {promptSaveStatus === 'error' && <span className="text-sm text-red-600">저장에 실패했습니다.</span>}
                  <button
                    onClick={handleSavePrompts}
                    disabled={isSavingPrompts}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-blue-300 transition-all text-sm"
                  >
                    {isSavingPrompts ? '저장 중...' : '프롬프트 저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ✅ [추가] 동영상 완료 모달 */}
        {showVideoCompleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => {
            setShowVideoCompleteModal(false);
            setCompletedVideoId(null);
          }}>
            <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-yellow-400 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="text-5xl md:text-6xl mb-4">🎬✨</div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">동영상 완성!</h2>
                <p className="text-gray-600 mb-4">동화 동영상이 성공적으로 만들어졌어요!</p>

                {/* 다운로드 위치 안내 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-left">
                  <p className="font-semibold text-blue-900 mb-1">📱 저장 위치 안내</p>
                  <ul className="text-blue-800 text-xs space-y-1">
                    <li>• <strong>핸드폰</strong>: "다운로드" 폴더 또는 "파일" 앱</li>
                    <li>• <strong>아이폰</strong>: 파일 앱 → "다운로드" 폴더</li>
                    <li>• <strong>안드로이드</strong>: 내 파일 → "Download" 폴더</li>
                    <li>• <strong>PC</strong>: 다운로드 폴더</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3">
                  <a
                    href={apiService.getVideoDownloadUrl(completedVideoId)}
                    download={`fairytale_${completedVideoId}.mp4`}
                    onClick={() => {
                      // 모바일에서 추가 안내
                      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                        setTimeout(() => {
                          alert('💾 다운로드 시작!\n\n파일 앱 또는 다운로드 폴더에서 확인하세요.');
                        }, 500);
                      }
                    }}
                    className="w-full px-6 py-4 bg-gradient-to-r from-green-400 to-blue-400 text-white rounded-xl font-bold text-lg md:text-xl hover:from-green-500 hover:to-blue-500 transition-all shadow-lg text-center"
                  >
                    💾 동영상 다운로드
                  </a>

                  {/* 모바일 공유 버튼 (Web Share API 지원 시) */}
                  {navigator.share && (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: '동화 동영상',
                            text: '내가 만든 동화 동영상을 확인해보세요!',
                            url: apiService.getVideoDownloadUrl(completedVideoId)
                          });
                        } catch (err) {
                          console.log('공유 취소 또는 실패:', err);
                        }
                      }}
                      className="w-full px-6 py-3 bg-purple-100 text-purple-700 rounded-xl font-semibold border border-purple-300 hover:bg-purple-200 transition-all"
                    >
                      📤 공유하기
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowVideoCompleteModal(false);
                      setCompletedVideoId(null);
                      setStage('archive');
                    }}
                    className="w-full px-6 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-300 hover:bg-gray-100 transition-all"
                  >
                    보관함으로 돌아가기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}

window.EmotionTheater = EmotionTheater;
