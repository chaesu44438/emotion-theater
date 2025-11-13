const express = require("express");
const { usersContainer, settingsContainer } = require("../db");
const router = express.Router();

// --- 사용자 관리 ---

// [GET] /api/admin/users - 모든 사용자 목록 조회
router.get("/users", async (req, res) => {
  try {
    const { resources: users } = await usersContainer.items.readAll().fetchAll();
    // 비밀번호 해시는 제외하고 필요한 정보만 반환
    const userList = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    }));
    res.status(200).json(userList);
  } catch (error) {
    console.error("사용자 목록 조회 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// [DELETE] /api/admin/users/:id - 특정 사용자 삭제
router.delete("/users/:id", async (req, res) => {
    const { id } = req.params;
    const adminUserId = req.user.userId;
  
    if (id === adminUserId) {
      return res.status(400).json({ message: "관리자 자신의 계정은 삭제할 수 없습니다." });
    }
  
    try {
      // ✅ [수정] ID로 사용자를 직접 쿼리하여 찾습니다.
      const { resources: users } = await usersContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: id }],
        })
        .fetchAll();

      if (users.length === 0) {
        return res.status(404).json({ message: "삭제할 사용자를 찾을 수 없습니다." });
      }
      const userToDelete = users[0];
  
      // 찾은 아이템으로 삭제 작업을 수행합니다.
      await usersContainer.item(userToDelete.id, userToDelete.username).delete();
      res.status(204).send(); // 성공적으로 삭제되었으나 본문 내용은 없음
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({ message: "삭제할 사용자를 찾을 수 없습니다." });
      }
      console.error("사용자 삭제 오류:", error);
      res.status(500).json({ message: "사용자 삭제 중 오류가 발생했습니다." });
    }
  });

// --- 프롬프트 관리 ---

const STORY_PROMPT_ID = "storyPrompt";
const IMAGE_PROMPT_ID = "imagePromptSystem";

// [GET] /api/admin/prompts - 현재 프롬프트 설정 조회
router.get("/prompts", async (req, res) => {
  try {
    const { resource: storyPrompt } = await settingsContainer.item(STORY_PROMPT_ID, "prompt").read();
    const { resource: imagePrompt } = await settingsContainer.item(IMAGE_PROMPT_ID, "prompt").read();

    res.status(200).json({
      storyPrompt: storyPrompt?.value || null,
      imagePromptSystem: imagePrompt?.value || null,
    });
  } catch (error) {
    // 항목이 아직 없으면 404 오류가 발생할 수 있으므로 정상 처리
    if (error.code === 404) {
        return res.status(200).json({ storyPrompt: null, imagePromptSystem: null });
    }
    console.error("프롬프트 조회 오류:", error);
    res.status(500).json({ message: "프롬프트 조회 중 오류가 발생했습니다." });
  }
});

// [PUT] /api/admin/prompts - 프롬프트 설정 업데이트
router.put("/prompts", async (req, res) => {
  const { storyPrompt, imagePromptSystem } = req.body;

  if (!storyPrompt || !imagePromptSystem) {
    return res.status(400).json({ message: "두 개의 프롬프트 내용이 모두 필요합니다." });
  }

  try {
    const operations = [
      { id: STORY_PROMPT_ID, type: "prompt", value: storyPrompt },
      { id: IMAGE_PROMPT_ID, type: "prompt", value: imagePromptSystem },
    ];

    // upsert: 항목이 없으면 생성, 있으면 업데이트
    await Promise.all(operations.map(op => settingsContainer.items.upsert(op)));

    res.status(200).json({ message: "프롬프트가 성공적으로 업데이트되었습니다." });
  } catch (error) {
    console.error("프롬프트 업데이트 오류:", error);
    res.status(500).json({ message: "프롬프트 업데이트 중 오류가 발생했습니다." });
  }
});


module.exports = router;