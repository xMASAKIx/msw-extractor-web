/**
 * MSW Nexon API 核心模組 - 5碼ID修復版
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

    async proxyFetch(url, isProfile = false) {
        // 只有非 Profile API 才強制加上 & 參數，避免某些 API 不支援多餘參數而報錯
        let finalUrl = url;
        if (!isProfile) {
            const separator = url.includes('?') ? '&' : '?';
            const cacheBuster = `${separator}_cb=${Date.now()}_${Math.random().toString(36).substring(7)}`;
            finalUrl = url + cacheBuster;
        }
        
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
    },

    async getPpsnByCode(profileCode) {
        // 修正：針對 Profile API 使用專用的請求標記
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        try {
            const json = await this.proxyFetch(url, true);
            if (json?.data?.ppsn) {
                console.log(`解析成功: ${profileCode} -> ${json.data.ppsn}`);
                return json.data.ppsn;
            }
            throw new Error("API 未回傳 PPSN 資料");
        } catch (e) {
            console.error("5碼ID轉換失敗:", e);
            throw new Error("找不到該玩家，請確認 5 碼 ID 是否正確");
        }
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        
        // 判斷是否為 5 碼 ID
        if (ppsn.length === 5) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        return (json?.data?.items || []).filter(item => whitelist.includes(item.avatarType));
    }
};

window.NexonAPI = NexonAPI;
