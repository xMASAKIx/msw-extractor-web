/**
 * MSW Nexon API 核心模組 - 價格校對強化版
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
        // 使用 allorigins 作為更穩定的 CORS 代理
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { headers: this.getHeaders() });
        
        if (response.status === 401) throw new Error("憑證已失效，請重新儲存憑證");
        
        const json = await response.json();
        if (json.code !== undefined && json.code !== 0) {
            console.warn(`Nexon API 異常代碼: ${json.code}`, json.message);
        }
        return json;
    },

    /**
     * 核心強化：獲取真實當前價格
     * 優先順序：商城搜尋名稱 > 直接請求商品 ID 詳細資料 (Godot 邏輯)
     */
    async getRealProductDetail(itemName, fallbackItemId) {
        try {
            // 方法 A：透過名稱搜尋當前掛單
            const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
            const res = await this.proxyFetch(searchUrl);
            const items = res.data?.items || res.list || [];
            
            if (items.length > 0) {
                const data = items[0];
                // 如果抓到的名稱完全符合，則返回該掛單價格
                if (data.itemName === itemName || items.length === 1) {
                    return {
                        price: data.targetPrice || data.itemPrice || 0,
                        itemId: data.itemId || data.id,
                        img: data.itemThumbnailUrl || data.itemImageUrl || data.thumbnail,
                        author: data.nickname || data.profileName || "未知"
                    };
                }
            }

            // 方法 B：如果搜尋不到掛單，使用 Godot 預購邏輯，直接由商品 ID 查詢
            if (fallbackItemId && fallbackItemId !== "N/A" && fallbackItemId.length > 5) {
                const detailUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${fallbackItemId}`;
                const detailRes = await this.proxyFetch(detailUrl);
                if (detailRes.data) {
                    const d = detailRes.data;
                    return {
                        price: d.targetPrice || d.itemPrice || 0,
                        itemId: d.itemId,
                        img: d.itemThumbnailUrl || d.itemImageUrl,
                        author: d.nickname || "未知"
                    };
                }
            }
        } catch (e) {
            console.error(`校對 [${itemName}] 價格時出錯:`, e);
        }
        return null;
    },

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        if (json.data && json.data.ppsn) return json.data.ppsn;
        throw new Error("找不到玩家 PPSN");
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        if (rawItems.length === 0) return [];

        return rawItems.map(item => ({
            itemName: item.itemName,
            itemId: item.itemId || item.ruid || "N/A", 
            itemImageUrl: item.itemImageUrl || item.itemThumbnailUrl || ""
        }));
    }
};

window.NexonAPI = NexonAPI;
