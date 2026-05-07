/**
 * MSW Nexon API 核心模組 (穩定圖片版)
 * 修復：確保縮圖網址遺失時，能自動抓取原始圖或商城圖
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

    /**
     * 邏輯 A：從 Godot 預購腳本提取的真實資料查詢
     */
    async getItemDetailById(itemId) {
        if (!itemId || itemId === "0") return null;
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${itemId}`;
        try {
            const res = await this.proxyFetch(url);
            if (res.code === 0 && res.data) {
                const d = res.data;
                return {
                    price: d.itemPrice,
                    name: d.itemName,
                    // 這裡也做圖片多重備份
                    img: d.itemThumbnailUrl || d.itemImageUrl || d.thumbnail,
                    author: d.nickname || "未知"
                };
            }
        } catch (e) { return null; }
        return null;
    },

    /**
     * 邏輯 B：名稱搜尋備案
     */
    async getItemDetailByName(itemName) {
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        try {
            const res = await this.proxyFetch(url);
            const items = res.data?.items || res.list || [];
            if (items.length > 0) {
                const p = items[0];
                return {
                    id: p.itemId || p.id,
                    price: p.targetPrice || p.itemPrice || 0,
                    author: p.nickname || p.profileName || "未知",
                    img: p.itemImageUrl || p.itemThumbnailUrl || p.thumbnail
                };
            }
        } catch (e) { return null; }
        return null;
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        // 5碼轉PPSN
        if (ppsn.length === 5 || (ppsn.startsWith('#') && ppsn.length === 6)) {
            const clean = ppsn.startsWith('#') ? ppsn.substring(1) : ppsn;
            const res = await this.proxyFetch(`https://mverse-api.nexon.com/profile/v1/profileCode/${clean}`);
            ppsn = res.data.ppsn;
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        const rawItems = (json.data?.items || []).filter(item => whitelist.includes(item.avatarType));

        return await Promise.all(rawItems.map(async (item) => {
            // 優先比對商城真實資料
            let real = await this.getItemDetailById(item.itemId);
            if (!real) real = await this.getItemDetailByName(item.itemName);
            
            // 【關鍵】圖片網址保險絲：按順序抓取第一個有值的網址
            const finalImg = real?.img || item.itemImageUrl || item.itemThumbnailUrl || item.thumbnail;

            return {
                itemName: item.itemName,
                itemId: real?.id || real?.itemId || item.itemId || item.ruid || "N/A",
                // 價格格式化
                targetPrice: real ? `${real.price} wc` : "已下架",
                nickname: real?.author || item.nickname || "非公開作者",
                // 使用保險絲過濾後的圖片
                itemImageUrl: finalImg
            };
        }));
    }
};

window.NexonAPI = NexonAPI;
