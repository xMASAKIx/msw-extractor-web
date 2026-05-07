/**
 * MSW Nexon API 核心模組 (Pro 版)
 * 功能：支援 5 碼 ID 轉換、裝備清單提取、商城真實資料比對
 */
const NexonAPI = {
    // 1. 取得存放在本地端或目前使用的憑證
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

    // 2. 封裝 Proxy 請求，解決 CORS 跨域問題
    async proxyFetch(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { headers: this.getHeaders() });

        if (response.status === 401) throw new Error("憑證已失效，請更新 AccessToken");
        if (response.status === 429) throw new Error("請求太頻繁 (429)，請稍候再試");
        if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);

        return await response.json();
    },

    /**
     * 3. 將 5 碼 ID (#xxxxx) 轉換為 PPSN
     */
    async getPpsnByCode(profileCode) {
        // 去除可能的 # 號
        const cleanCode = profileCode.startsWith('#') ? profileCode.substring(1) : profileCode;
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${cleanCode}`;
        
        try {
            const json = await this.proxyFetch(url);
            if (json.data && json.data.ppsn) {
                console.log(`[API] 轉換成功: ${profileCode} -> ${json.data.ppsn}`);
                return json.data.ppsn;
            }
            throw new Error("找不到該 5 碼 ID 對應的玩家");
        } catch (e) {
            throw new Error("轉換 ID 失敗: " + e.message);
        }
    },

    /**
     * 4. 關鍵加強：去商城搜尋該商品以獲取「真實 itemId」與「真實價格」
     * 對應 Godot 中的 SearchAPI 邏輯
     */
    async getRealProductDetail(itemName) {
        // 使用商城搜尋 API
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        
        try {
            const res = await this.proxyFetch(searchUrl);
            // 兼容不同 API 回傳格式 (data.items 或 list)
            const items = res.data?.items || res.list || [];
            
            if (items.length > 0) {
                const product = items[0];
                return {
                    realItemId: product.itemId || product.id,
                    realPrice: (product.targetPrice !== undefined) ? product.targetPrice : (product.itemPrice || 0),
                    authorName: product.nickname || product.profileName || "未知作者",
                    profileCode: product.profileCode || ""
                };
            }
            return null; // 商城查無此商品
        } catch (e) {
            console.warn(`[API] 無法校對商品 ${itemName} 的真實資料`, e);
            return null;
        }
    },

    /**
     * 5. 獲取穿戴中的裝備清單
     * 會自動根據輸入長度判斷是 PPSN 還是 5 碼 ID
     */
    async getEquipList(input) {
        let finalPpsn = input.trim();

        // 如果輸入的是 5 碼，先進行轉換
        if (finalPpsn.length === 5 || (finalPpsn.startsWith('#') && finalPpsn.length === 6)) {
            finalPpsn = await this.getPpsnByCode(finalPpsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${finalPpsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = json.data?.items || [];
        
        // 過濾掉不屬於裝備類型的資料
        const filteredItems = rawItems.filter(item => whitelist.includes(item.avatarType));

        // 對過濾後的每件裝備進行「真實資料校對」
        const finalizedItems = await Promise.all(filteredItems.map(async (item) => {
            const realInfo = await this.getRealProductDetail(item.itemName);
            
            return {
                ...item,
                // 如果商城有資料，優先使用商城的 itemId 和價格
                itemId: realInfo ? realInfo.realItemId : (item.itemId || "未上架"),
                targetPrice: realInfo ? realInfo.realPrice : 0,
                nickname: realInfo ? realInfo.authorName : (item.nickname || "未知"),
                isRealVerified: !!realInfo // 標記是否成功比對到商城資料
            };
        }));

        return finalizedItems;
    }
};

// 匯出至全域
window.NexonAPI = NexonAPI;
