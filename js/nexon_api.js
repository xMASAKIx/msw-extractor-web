/**
 * MSW Nexon API 核心模組 - 2026 穩定增強版
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

    /**
     * 代理請求 - 加入強制作廢快取邏輯
     */
    async proxyFetch(url) {
        // 加入隨機時間戳記繞過代理快取
        const cacheBuster = `&_t=${Date.now()}`;
        const finalUrl = url.includes('?') ? (url + cacheBuster) : (url + "?" + cacheBuster.substring(1));
        
        // 使用 allorigins 搭配 random 參數降低快取命中率
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}`;

        try {
            const response = await fetch(proxyUrl, { 
                headers: this.getHeaders(),
                cache: 'no-store' 
            });
            
            if (response.status === 401 || response.status === 403) throw new Error("AccessToken 已失效");
            return await response.json();
        } catch (e) {
            console.error("Fetch 失敗:", e);
            return null;
        }
    },

    /**
     * 核心：從商城搜尋商品獲取真實價格、ID、以及賣家資訊 (PPSN)
     */
    async getRealProductDetail(itemName) {
        // sort=1 代表最新上架或相關度排序
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        
        try {
            const res = await this.proxyFetch(searchUrl);
            // 處理不同 API 版本的回傳結構
            const items = res?.data?.items || res?.list || [];
            
            if (items.length > 0) {
                const data = items[0];
                
                // 優先提取真實價格與賣家唯一辨識碼 (sellerPpsn)
                return {
                    price: data.itemPrice ?? data.targetPrice ?? 0, 
                    itemId: data.itemId || data.id || "未知",           
                    img: data.itemThumbnailUrl || data.itemImageUrl || data.thumbnail || "", 
                    author: data.nickname || data.profileName || "未知",
                    // 這裡就是你要的 sellerPpsn
                    sellerPpsn: data.sellerPpsn || "未知",
                    avatarStatus: data.avatarStatus || "" 
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
