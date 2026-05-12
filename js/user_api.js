// js/user_api.js
const UserAPI = {
    async getProfile(input) {
        try {
            // 1. 先透過 NexonAPI 取得裝備列表，進而拿到轉換後的 PPSN
            const rawItems = await NexonAPI.getEquipList(input);
            if (!rawItems || rawItems.length === 0) throw new Error("找不到該玩家");

            const ppsn = rawItems[0].ppsn || rawItems[0].worldPpsn;
            
            // 2. 獲取本地儲存的 Token (這對於請求 Profile API 是必須的)
            const savedAccounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || "[]");
            const token = savedAccounts.length > 0 ? savedAccounts[0].token : "";

            // 3. 使用標準 fetch 請求 Profile，並帶上 Header
            const response = await fetch(`https://mverse-api.nexon.com/social/v1/profile/${ppsn}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) throw new Error(`API 請求失敗: ${response.status}`);
            
            const result = await response.json();
            
            if (result && result.data) {
                return result.data;
            } else {
                throw new Error("Profile 資料格式錯誤");
            }
        } catch (err) {
            console.error("UserAPI Error:", err);
            throw err;
        }
    }
};
