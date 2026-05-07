/**
 * MSW Nexon API 核心模組 - 徹底去快取版
 */
const NexonAPI = {
    getHeaders: () => {
        const accounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || '[]');
        const currentAccount = accounts[0] || { userId: '', token: '' };
        return {
            "mod-accesstoken": currentAccount.token,
            "mod-user-id": currentAccount.userId,
            "Accept": "application/json",
            "Content-Type": "application/json",
            // 強制要求瀏覽器與代理不使用快取
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        };
    },

    async proxyFetch(url) {
        // 使用隨機數 + 時間戳記，確保每個請求對代理伺服器來說都是全新的
        const randomSeed = Math.random().toString(36).substring(7);
        const cacheBuster = `&nocache=${Date.now()}_${randomSeed}`;
        const finalUrl = url + cacheBuster;
        
        // 更換代理服務，或是強迫 allorigins 重新抓取
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(finalUrl)}&disableCache=true`;

        try {
            const response = await fetch(proxyUrl, { 
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            
            const outerJson = await response.json();
            // allorigins 返回的結果在 .contents 裡面，且通常是字串，需要解析
            const data = typeof outerJson.contents === 'string' 
                ? JSON.parse(outerJson.contents) 
                : outerJson.contents;

            if (data?.code === 401 || data?.code === 403) throw new Error("AccessToken 失效");
            return data;
        } catch (e) {
            console.error("Fetch 失敗:", e);
            return null;
        }
    },

    /**
     * 核心：從商城搜尋商品獲取真實價格與作者 ID (PPSN)
     */
    async getRealProductDetail(itemName) {
        // 注意：這裡直接請求單一商品的 search，並確保關鍵字完全符合
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        
        try {
            const res = await this.proxyFetch(searchUrl);
            
            // 根據你提供的 Log 結構，資料層級在 res.data.items 或是 res.data
            let targetData = null;
            if (res?.data?.items && res.data.items.length > 0) {
                targetData = res.data.items[0];
            } else if (res?.data && !Array.isArray(res.data)) {
                targetData = res.data;
            }

            if (targetData) {
                return {
                    // 抓取你 Log 裡的 itemPrice: 15.0
                    price: targetData.itemPrice ?? targetData.targetPrice ?? 0, 
                    itemId: targetData.itemId || targetData.id || "N/A",           
                    img: targetData.itemThumbnailUrl || targetData.itemImageUrl || "", 
                    author: targetData.nickname || "未知",
                    // 抓取你 Log 裡的 sellerPpsn: "20372100008443475"
                    sellerPpsn: targetData.sellerPpsn || "N/A"
                };
            }
        } catch (e) {
            console.error(`解析 [${itemName}] 出錯:`, e);
        }
        return null;
    }
};

    /**
     * 將 5 碼 ID 轉換為系統用的 PPSN
     */
    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        try {
            const json = await this.proxyFetch(url);
            if (json?.data?.ppsn) return json.data.ppsn;
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
        
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url); 
        
        if (!json || !json.data) return [];

        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data.items || []).filter(item => whitelist.includes(item.avatarType));

        return rawItems.map(item => ({
            itemName: item.itemName,
            itemId: item.itemId || item.ruid || "N/A", 
            itemImageUrl: item.itemImageUrl || item.itemThumbnailUrl || ""
        }));
    }
};

// 掛載到全域讓 index.html 存取
window.NexonAPI = NexonAPI;
