// js/user_api.js
const UserAPI = {
    // 獲取用戶資料的核心方法
    async getProfile(input) {
        try {
            // 1. 先透過 NexonAPI 取得 PPSN (利用你現有的 getEquipList 邏輯)
            // 這是最穩定的轉 ID 方式，因為它已經處理好了跨域
            const rawItems = await NexonAPI.getEquipList(input);
            
            if (!rawItems || rawItems.length === 0) {
                throw new Error("找不到該玩家");
            }

            // 取得轉換後的 PPSN
            const ppsn = rawItems[0].ppsn || rawItems[0].worldPpsn;

            // 2. 使用 PPSN 請求詳細資料
            // 注意：這裡必須使用 NexonAPI 內部那個能繞過 CORS 的請求方法 (例如 NexonAPI.request)
            const response = await NexonAPI.request(`https://mverse-api.nexon.com/social/v1/profile/${ppsn}`);
            
            if (response && response.data) {
                return response.data; // 回傳包含 profileImageUrl, nickname, profileCode, ppsn 的物件
            } else {
                throw new Error("無法讀取 Profile API");
            }
        } catch (err) {
            console.error("UserAPI Error:", err);
            throw err;
        }
    }
};
