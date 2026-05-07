/**
 * MSW Nexon API 核心模組
 * 整合了穩定版網址與動態 Token 儲存邏輯
 */
const NexonAPI = {
    // 優先使用你的原始穩定版網址配置
    getHeaders: () => {
        // 從 AccountManager 取得當前存好的帳號資料
        const accounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || '[]');
        // 預設取第一組帳號，或依照你的需求調整
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

    // 封裝 Fetch 邏輯（使用 corsproxy.io）
    async proxyFetch(url) {
        // 使用你的原始穩定版 Proxy 格式
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(proxyUrl, {
                headers: this.getHeaders()
            });

            if (response.status === 401) {
                throw new Error("憑證已失效 (UNAUTHORIZED)，請更新 Token");
            }
            if (!response.ok) {
                // 如果遇到 530 錯誤，通常是 Proxy 暫時性問題
                throw new Error(`伺服器錯誤 (代碼: ${response.status})`);
            }
            return await response.json();
        } catch (err) {
            console.error("Fetch 失敗:", err);
            throw err;
        }
    },

    /**
     * 1. 獲取 PPSN (由 5 碼 ID 轉換)
     */
    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        
        if (json.data && json.data.ppsn) {
            return {
                ppsn: json.data.ppsn,
                profileName: json.data.profileName
            };
        } else {
            throw new Error("找不到該玩家 ID");
        }
    },

    /**
     * 2. 獲取玩家穿戴裝備清單 (使用你提供的穩定網域)
     */
    async getEquipList(ppsn) {
        // 使用你一開始提供的穩定版 Gateway 網址
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        // 裝備類型白名單
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        
        // 確保資料結構正確並過濾
        const items = json.data?.items || [];
        return items.filter(item => whitelist.includes(item.avatarType));
    }
};

// 匯出供頁面使用
window.NexonAPI = NexonAPI;
