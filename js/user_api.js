// js/user_api.js
const UserAPI = {
    async getProfile(input) {
        try {
            let ppsn = input.trim();

            // 1. 如果輸入的是 5 碼 ID，先轉換成 PPSN
            if (ppsn.length === 5) {
                ppsn = await NexonAPI.getPpsnByCode(ppsn);
            }

            // 2. 呼叫 Nexon 官方 Profile API，並使用你定義好的 proxyFetch 避開跨域
            const url = `https://mverse-api.nexon.com/social/v1/profile/${ppsn}`;
            const res = await NexonAPI.proxyFetch(url, true);

            if (res && res.data) {
                const d = res.data;
                return {
                    profileImageUrl: d.profileImageUrl || '',
                    nickname: d.nickname || d.profileName || '未知玩家',
                    profileCode: d.profileCode || '',
                    ppsn: d.ppsn || ppsn
                };
            } else {
                throw new Error("無法解析 Profile 資料");
            }
        } catch (err) {
            console.error("UserAPI Error:", err);
            throw err;
        }
    }
};
