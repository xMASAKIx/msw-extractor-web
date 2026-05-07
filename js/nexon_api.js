/**
 * MSW Nexon API 核心模組 - 純淨價格版
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
    // 嘗試改用另一個較穩定的代理 (例如 hexarular)
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    // 如果上面那個還是紅字，請嘗試改用這個 (通常這個比較穩定)：
    // const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`; 
    // 注意：使用 cors-anywhere 可能需要先去 https://cors-anywhere.herokuapp.com/checkout 點擊啟動臨時權限
    
    try {
        const response = await fetch(proxyUrl, { headers: this.getHeaders() });
            if (response.status === 401) throw new Error("AccessToken 已失效");
            return await response.json();
        } catch (e) {
            console.error("Fetch Error:", e);
            return null;
        }
    },

    /**
     * 只抓取 %S 價格
     * @param {string} itemName - 用於搜尋
     * @param {string} itemId - 用於直接查詢 (Godot 核心邏輯)
     */
    async getRealProductDetail(itemName, itemId) {
        try {
            // 1. 優先用 itemId 直接查（最準確，對標 Godot 的 avatars/%s）
            if (itemId && itemId !== "N/A" && /^\d+$/.test(itemId)) {
                const detailUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${itemId}`;
                const res = await this.proxyFetch(detailUrl);
                
                if (res && res.code === 0 && res.data) {
                    return { price: res.data.itemPrice || 0 };
                }
            }

            // 2. 備案：用名稱搜尋
            const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
            const sRes = await this.proxyFetch(searchUrl);
            const items = sRes?.data?.items || sRes?.list || [];
            
            if (items.length > 0) {
                return { price: items[0].itemPrice || items[0].targetPrice || 0 };
            }
        } catch (e) {
            console.error("價格抓取失敗:", e);
        }
        return { price: "未知" };
    },

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        return json?.data?.ppsn || null;
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5) ppsn = await this.getPpsnByCode(ppsn);
        if (!ppsn) return [];

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        return (json.data?.items || [])
            .filter(item => whitelist.includes(item.avatarType))
            .map(item => ({
                itemName: item.itemName,
                itemId: item.itemId || item.ruid || "N/A"
            }));
    }
};

window.NexonAPI = NexonAPI;
