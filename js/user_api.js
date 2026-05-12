// js/user_api.js
const UserAPI = {
    async getProfile(input) {
        try {
            // 1. 先透過 getEquipList 取得該 ID 對應的 PPSN
            // 這是目前最穩定的轉換方式
            const rawItems = await NexonAPI.getEquipList(input);
            if (!rawItems || rawItems.length === 0) throw new Error("找不到該玩家");

            // 取得該目標玩家的 PPSN
            const ppsn = rawItems[0].ppsn || rawItems[0].worldPpsn;

            // 2. 使用 NexonAPI 內部的請求工具（避開 CORS）去抓取 Profile
            // 關鍵：這裡必須使用 NexonAPI 裡面那個實際發送請求的方法
            // 如果你的檔案裡叫 NexonAPI.fetchData，請自行替換名稱
            const url = `https://mverse-api.nexon.com/social/v1/profile/${ppsn}`;
            
            // 嘗試偵測並使用正確的請求方法
            const requestFunc = NexonAPI.request || NexonAPI.fetch || NexonAPI.fetchData;
            
            if (!requestFunc) {
                throw new Error("找不到 NexonAPI 的請求封裝方法");
            }

            const response = await requestFunc(url);
            
            if (response && response.data) {
                return {
                    profileImageUrl: response.data.profileImageUrl || '',
                    nickname: response.data.nickname || 'Unknown',
                    profileCode: response.data.profileCode || input,
                    ppsn: response.data.ppsn || ppsn
                };
            } else {
                throw new Error("無法解析玩家資料");
            }
        } catch (err) {
            console.error("UserAPI Error:", err);
            throw err;
        }
    }
};
