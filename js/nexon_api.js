/**
 * MSW Nexon API 核心模組 (支援自動轉換 ID)
 */
const NexonAPI = {
    // 取得當前存好的 Token
    getHeaders: () => {
        const accounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || '[]');
        const currentAccount = accounts[0] || { userId: '', token: '' };
        return {
            "mod-accesstoken": currentAccount.token,
            "mod-user-id": currentAccount.userId,
            "x-mod-client": "727d112f1370415e85686530ec048fb7",
            "x-mod-runtime-version": "1.25.6.672",
            "x-mod-client-platform": "win",
            "mod-caller": "mod",
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
    },

    // 穩定的 Proxy 請求封裝
    async proxyFetch(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { headers: this.getHeaders() });

        if (response.status === 401) throw new Error("憑證已失效");
        if (response.status === 530) throw new Error("Proxy 暫時繁忙 (530)，請稍後再試");
        if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);

        return await response.json();
    },

    /**
     * 關鍵新增：將 5 碼 ID 轉換為 PPSN
     */
    async getPpsnByCode(profileCode) {
        // 使用 mverse-api 進行轉換
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        
        if (json.data && json.data.ppsn) {
            console.log(`轉換成功: ${profileCode} -> ${json.data.ppsn}`);
            return json.data.ppsn;
        } else {
            throw new Error("找不到該 5 碼 ID 對應的玩家");
        }
    },

    /**
     * 獲取裝備清單 (會自動判斷輸入類型)
     */
    async getEquipList(input) {
        let finalPpsn = input;

        // 如果輸入的是 5 碼 (純數字或長度為 5)，先跑轉換
        if (input.length === 5) {
            finalPpsn = await this.getPpsnByCode(input);
        }

        // 使用你原本穩定的 Gateway 網址
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${finalPpsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const items = json.data?.items || [];
        
        return items.filter(item => whitelist.includes(item.avatarType));
    }
};

window.NexonAPI = NexonAPI;
