/**
 * MSW Nexon API 核心模組 - 最終穩定優化版 (支援 Godot 價格校對)
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
        // 使用 AllOrigins 繞過 CORS 限制，這對 GitHub Pages 最穩定
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(proxyUrl, { headers: this.getHeaders() });
            
            if (response.status === 401) throw new Error("憑證已失效，請重新儲存憑證");
            if (!response.ok) throw new Error(`網路請求失敗: ${response.status}`);
            
            const json = await response.json();
            
            // 處理 Nexon 內部的錯誤代碼
            if (json.code !== undefined && json.code !== 0) {
                console.warn(`Nexon API 異常 [${json.code}]: ${json.message}`);
            }
            return json;
        } catch (e) {
            console.error("Proxy Fetch Error:", e);
            throw e;
        }
    },

    /**
     * 核心校對：獲取真實商城價格
     * 邏輯：搜尋名稱 (最新掛單) -> 若無則直接查商品 ID (Godot 預購邏輯)
     */
    async getRealProductDetail(itemName, fallbackItemId) {
        try {
            // A. 優先嘗試名稱搜尋 (抓取最新掛單價格)
            const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
            const res = await this.proxyFetch(searchUrl);
            const items = res.data?.items || res.list || [];
            
            if (items.length > 0) {
                const data = items[0];
                // 檢查名稱是否相符，或是搜尋結果唯一
                if (data.itemName === itemName || items.length === 1) {
                    return {
                        price: data.targetPrice || data.itemPrice || 0,
                        itemId: data.itemId || data.id,
                        img: data.itemThumbnailUrl || data.itemImageUrl || data.thumbnail,
                        author: data.nickname || data.profileName || "未知"
                    };
                }
            }

            // B. 若搜尋不到掛單 (通常是未在架上或名稱太短)，使用 Godot 邏輯直接查 ID
            // 注意：ruid 通常不適用此接口，必須是真正的 itemId (數字串)
            if (fallbackItemId && fallbackItemId !== "N/A" && /^\d+$/.test(fallbackItemId)) {
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
            console.error(`[${itemName}] 價格校對失敗:`, e);
        }
        return null; // 回傳 null 讓前端顯示「未知」
    },

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        if (json.data && json.data.ppsn) return json.data.ppsn;
        throw new Error("找不到玩家資訊，請確認 5 碼 ID 是否正確");
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        // 過濾我們感興趣的部位
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        if (rawItems.length === 0) return [];

        return rawItems.map(item => ({
            itemName: item.itemName,
            // 優先儲存 itemId，若無則儲存 ruid
            itemId: item.itemId || item.ruid || "N/A", 
            itemImageUrl: item.itemImageUrl || item.itemThumbnailUrl || ""
        }));
    }
};

// 確保掛載到全域
window.NexonAPI = NexonAPI;
