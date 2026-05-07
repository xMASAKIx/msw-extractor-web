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
        let finalUrl = url;
        if (!isProfile) {
            const separator = url.includes('?') ? '&' : '?';
            // 使用更簡潔的 cache buster，避免 URL 過長導致代理失敗
            finalUrl = url + `${separator}_t=${Date.now()}`;
        }
        
        // 截圖顯示 allorigins 失敗，這裡強制改用 corsproxy.io
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

    async getRealProductDetail(input) {
    let url;
    // 判斷是否為 8 碼商品 ID
    const isId = /^[A-Z0-9]{8,9}$/.test(input);

    if (isId) {
        url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${input}`;
    } else {
        url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(input)}`;
    }

    try {
        const res = await this.proxyFetch(url);
        const d = isId ? res?.data : (res?.data?.items?.[0] || res?.list?.[0]);

        if (d) {
            // --- 核心修改：組合作者暱稱與 5 碼 ID ---
            const authorName = d.nickname || d.profileName || "未知";
            const authorCode = d.profileCode ? `#${d.profileCode}` : "";
            const authorDisplay = `${authorName}${authorCode}`; // 結果範例: 小波(#ABCDE)

            return {
                price: d.itemPrice ?? d.targetPrice ?? 0,
                sellerPpsn: d.sellerPpsn || "N/A",
                nickname: d.nickname || d.profileName || "未知",
                profileCode: d.profileCode || "", // 確保有回傳 5 碼 ID
                itemId: d.itemId || d.id || input
            };
        }
    } catch (e) { 
        console.error("獲取商品詳情失敗", e); 
    }
    return null;
},

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url, true);
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

window.NexonAPI = NexonAPI;
