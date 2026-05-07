/**
 * MSW Nexon API 核心模組 - 完整版
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
        if (response.status === 401) throw new Error("憑證已失效");
        return await response.json();
    },

    // 透過 ID 抓取商城精確資料 (包含縮圖網址)
    async getItemDetailById(itemId) {
        if (!itemId || itemId === "0") return null;
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${itemId}`;
        try {
            const res = await this.proxyFetch(url);
            if (res.code === 0 && res.data) {
                return {
                    price: res.data.itemPrice,
                    name: res.data.itemName,
                    // 備援圖片邏輯：縮圖 > 原始圖
                    img: res.data.itemThumbnailUrl || res.data.itemImageUrl || res.data.thumbnail,
                    author: res.data.nickname || "未知"
                };
            }
        } catch (e) { return null; }
        return null;
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        // 支援 5 碼 ID 轉換為 PPSN
        if (ppsn.length === 5) {
            const res = await this.proxyFetch(`https://mverse-api.nexon.com/profile/v1/profileCode/${ppsn}`);
            ppsn = res.data.ppsn;
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        return await Promise.all(rawItems.map(async (item) => {
            const real = await this.getItemDetailById(item.itemId);
            // 優先使用商城的完整網址，若無則回退到清單內的網址
            const finalImg = real?.img || item.itemImageUrl || item.itemThumbnailUrl || "";

            return {
                itemName: item.itemName,
                itemId: real?.id || item.itemId || item.ruid || "N/A",
                targetPrice: real ? real.price : "???",
                nickname: real?.author || item.nickname || "未知",
                itemImageUrl: finalImg // 這就是你要顯示的縮圖網址
            };
        }));
    }
};
