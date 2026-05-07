/**
 * MSW Nexon API 核心模組 (穩定修復版)
 * 修復：當商城搜尋不到 (??? WC) 時，保留原始圖片與資料
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

        if (response.status === 401) throw new Error("憑證已失效，請重新儲存 AccessToken");
        if (response.status === 530) throw new Error("Proxy 暫時繁忙 (530)，請稍後再試");
        if (response.status === 429) throw new Error("請求太頻繁，請等 10 秒後再試");
        
        return await response.json();
    },

    async getPpsnByCode(profileCode) {
        const cleanCode = profileCode.startsWith('#') ? profileCode.substring(1) : profileCode;
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${cleanCode}`;
        const json = await this.proxyFetch(url);
        if (json.data && json.data.ppsn) return json.data.ppsn;
        throw new Error("找不到該 5 碼 ID 對應的玩家");
    },

    /**
     * 獲取商城真實資料
     */
    async getRealProductDetail(itemName) {
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        try {
            const res = await this.proxyFetch(searchUrl);
            const items = res.data?.items || res.list || [];
            if (items.length > 0) {
                const p = items[0];
                return {
                    itemId: p.itemId || p.id,
                    price: p.targetPrice !== undefined ? p.targetPrice : (p.itemPrice || 0),
                    author: p.nickname || p.profileName || "未知",
                    img: p.itemImageUrl || p.itemThumbnailUrl
                };
            }
        } catch (e) { console.warn("商城比對失敗:", itemName); }
        return null;
    },

    /**
     * 獲取穿戴清單 (核心修復邏輯)
     */
    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5 || (ppsn.startsWith('#') && ppsn.length === 6)) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        // 逐一校對資料
        return await Promise.all(rawItems.map(async (item) => {
            const real = await this.getRealProductDetail(item.itemName);
            
            // 如果商城有資料就用商城的，沒資料就用原始穿戴清單的資料
            return {
                itemName: item.itemName,
                itemId: real ? real.itemId : (item.itemId || item.ruid || "N/A"),
                targetPrice: real ? real.price : "已下架", 
                nickname: real ? real.author : "非公開作者",
                // 重要：如果商城查不到圖，一定要用原本 item 的圖片網址
                itemImageUrl: real ? real.img : (item.itemImageUrl || item.itemThumbnailUrl),
                isReal: !!real
            };
        }));
    }
};

window.NexonAPI = NexonAPI;
