/**
 * MSW Nexon API 核心模組 - 穩定增強版
 */
const NexonAPI = {
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

    async proxyFetch(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { headers: this.getHeaders() });
        
        // 處理 HTTP 401 認證錯誤
        if (response.status === 401) throw new Error("憑證已失效，請重新更新 AccessToken");
        
        const json = await response.json();
        
        // 處理 Nexon API 內部的錯誤代碼 (例如代碼非 0)
        if (json.code !== undefined && json.code !== 0) {
            console.warn(`API 回傳異常代碼: ${json.code}`, json.message);
        }
        
        return json;
    },

    /**
     * 核心：從商城搜尋商品獲取真實價格與 ID
     */
    async getRealProductDetail(itemName) {
        // 使用 sort=1 (最新) 搜尋
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        try {
            const res = await this.proxyFetch(searchUrl);
            const items = res.data?.items || res.list || [];
            
            if (items.length > 0) {
                const data = items[0];
                return {
                    price: data.targetPrice || data.itemPrice || 0, 
                    itemId: data.itemId || data.id,           
                    img: data.itemThumbnailUrl || data.itemImageUrl || data.thumbnail, 
                    author: data.nickname || data.profileName || "未知"
                };
            }
        } catch (e) {
            console.error(`無法獲取商品 [${itemName}] 的商城詳情:`, e);
        }
        return null;
    },

    /**
     * 將 5 碼 ID 轉換為系統用的 PPSN
     */
    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        try {
            const json = await this.proxyFetch(url);
            if (json.data && json.data.ppsn) return json.data.ppsn;
        } catch (e) {
            throw new Error(`玩家 ID (${profileCode}) 查詢失敗`);
        }
        throw new Error("找不到該玩家，請檢查 5 碼 ID 是否正確");
    },

    /**
     * 抓取玩家當前穿戴清單
     */
    async getEquipList(input) {
        let ppsn = input.trim();
        
        // 如果輸入是 5 碼則先轉換
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        // 裝備過濾清單
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        if (rawItems.length === 0) return [];

        return rawItems.map(item => ({
            itemName: item.itemName,
            // 穿戴清單提供的 itemId 有時是 RUID，先紀錄起來，後續由 getRealProductDetail 校對
            itemId: item.itemId || item.ruid || "N/A", 
            itemImageUrl: item.itemImageUrl || item.itemThumbnailUrl || ""
        }));
    }
};

// 掛載到全域讓 index.html 存取
window.NexonAPI = NexonAPI;
