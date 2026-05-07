/**
 * MSW Nexon API 核心模組 - 完整價格校對版
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
        if (response.status === 401) throw new Error("憑證已失效，請重新儲存");
        return await response.json();
    },

    /**
     * 核心加強：去商城搜尋該商品以獲取「真實當前價格」與「詳細資料」
     * 穿戴清單通常不帶價格，必須透過這個搜尋接口補完資料
     */
    async getRealProductDetail(itemName) {
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        try {
            const res = await this.proxyFetch(searchUrl);
            const items = res.data?.items || res.list || [];
            if (items.length > 0) {
                const data = items[0];
                return {
                    price: data.targetPrice || data.itemPrice, // 當前商城售價
                    itemId: data.itemId || data.id,           // 商城正式商品 ID
                    img: data.itemThumbnailUrl || data.itemImageUrl, // 商城縮圖
                    author: data.nickname || data.profileName || "未知"
                };
            }
        } catch (e) {
            console.error(`無法獲取 ${itemName} 的商城詳情:`, e);
        }
        return null;
    },

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        if (json.data && json.data.ppsn) return json.data.ppsn;
        throw new Error("找不到該 ID 對應的玩家");
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        // 支援 5 碼 ID 轉換為 PPSN
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        // 這裡會回傳清單，之後在前端 index.html 的迴圈中
        // 再呼叫 getRealProductDetail(item.itemName) 來補齊價格與縮圖
        return rawItems.map(item => ({
            itemName: item.itemName,
            itemId: item.itemId || item.ruid || "N/A",
            itemImageUrl: item.itemImageUrl || item.itemThumbnailUrl || ""
        }));
    }
};

// 確保掛載到 window 物件，讓 index.html 抓得到
window.NexonAPI = NexonAPI;
