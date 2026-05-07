/**
 * MSW Nexon API 核心模組 - 徹底修復版
 */
const NexonAPI = {
    getHeaders: () => {
        const accounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || '[]');
        const currentAccount = accounts[0] || { userId: '', token: '' };
        return {
            "mod-accesstoken": currentAccount.token,
            "mod-user-id": currentAccount.userId,
            "x-mod-client": "727d112f1370415e85686530ec048fb7",
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
    },

    async proxyFetch(url) {
        // 繞過快取
        const cacheBuster = `&_cb=${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const finalUrl = url + cacheBuster;
        
        // 更換代理為 corsproxy.io (支援自定義 Headers 且較少 Preflight 問題)
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`;

        try {
            const response = await fetch(proxyUrl, { 
                headers: this.getHeaders(),
                cache: 'no-store' 
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error("代理請求失敗:", e);
            return null;
        }
    },

    async getRealProductDetail(itemName) {
        const searchUrl = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(itemName)}`;
        try {
            const res = await this.proxyFetch(searchUrl);
            const items = res?.data?.items || res?.list || [];
            if (items.length > 0) {
                const d = items[0];
                return {
                    price: d.itemPrice ?? d.targetPrice ?? 0,
                    sellerPpsn: d.sellerPpsn || "N/A",
                    nickname: d.nickname || d.profileName || "未知",
                    itemId: d.itemId || d.id
                };
            }
        } catch (e) { console.error("商城搜尋失敗", e); }
        return null;
    }, // <-- 檢查這裡的逗號

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url);
        if (json?.data?.ppsn) return json.data.ppsn;
        throw new Error("找不到該玩家");
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5) ppsn = await this.getPpsnByCode(ppsn);

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        return (json?.data?.items || []).filter(item => whitelist.includes(item.avatarType));
    }
};

// 掛載到全域
window.NexonAPI = NexonAPI;
