// js/user_api.js
const UserAPI = {
    async getProfile(inputCode) {
        try {
            // 直接請求 Proxy API
            const response = await fetch(`https://msw-avatar-extractor.vercel.app/api/profile/basic?code=${inputCode}`);
            
            if (!response.ok) throw new Error(`Proxy API 請求失敗: ${response.status}`);
            
            const result = await response.json();
            
            // 根據該 API 的結構回傳資料
            // 假設回傳格式包含 profileImageUrl, nickname, profileCode, ppsn
            if (result) {
                return {
                    profileImageUrl: result.profileImageUrl || '',
                    nickname: result.nickname || result.profileName || '---',
                    profileCode: result.profileCode || '---',
                    ppsn: result.ppsn || '---'
                };
            } else {
                throw new Error("找不到該玩家資料");
            }
        } catch (err) {
            console.error("UserAPI Error:", err);
            throw err;
        }
    }
};
