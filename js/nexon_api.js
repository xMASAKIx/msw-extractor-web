const NexonAPI = {
    getHeaders: () => {
        const accounts = JSON.parse(localStorage.getItem('msw_accounts_v1') || '[]');
        const currentAccount = accounts[0] || {};
        
        const token = currentAccount.token || currentAccount.access_token || '';
        const userId = currentAccount.userId || currentAccount.user_id || '';

        return {
            "mod-accesstoken": token,
            "mod-user-id": userId,
            "x-mod-client": "727d112f1370415e85686530ec048fb7",
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
    },

    async proxyFetch(url, isProfile = false) {
        let finalUrl = url;
        if (!isProfile) {
            const separator = url.includes('?') ? '&' : '?';
            finalUrl = url + `${separator}_t=${Date.now()}`;
        }
        
        const proxyUrl = `http://localhost:3000/?url=${encodeURIComponent(finalUrl)}`;

        try {
            const response = await fetch(proxyUrl, { 
                headers: this.getHeaders(),
                cache: 'no-store' 
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error("本地代理請求失敗:", e);
            return null;
        }
    },

    async getProfileDetail(ppsn) {
        if (!ppsn || ppsn === "N/A") return null;
        const url = `https://mverse-api.nexon.com/social/v1/profile/${ppsn}`;
        const res = await this.proxyFetch(url, true);
        return res?.data || null;
    },

    async getRealProductDetail(input) {
        let url;
        const isId = /^[A-Z0-9]{8,9}$/.test(input);

        if (isId) {
            url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${input}`;
        } else {
            url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(input)}&_cb=${Date.now()}`;
        }

        try {
            const res = await this.proxyFetch(url);
            const d = isId ? res?.data : (res?.data?.items?.[0] || res?.list?.[0] || res?.data?.[0]);

            if (d) {
                const profile = d.sellerPpsn ? await this.getProfileDetail(d.sellerPpsn) : null;
                
                return {
                    price: d.itemPrice ?? d.targetPrice ?? d.price ?? "未知",
                    sellerPpsn: d.sellerPpsn || "",
                    nickname: profile?.profileName || d.nickname || d.profileName || "未知",
                    profileCode: profile?.profileCode || d.profileCode || "", 
                    itemId: d.itemId || d.id || input,
                    avatarType: d.avatarType || "",
                    itemName: d.itemName || d.name || "", 
                    itemThumbnailUrl: d.itemThumbnailUrl || d.thumbnail || ""
                };
            }
        } catch (e) { 
            console.error("獲取商品詳情失敗", e); 
        }
        return { price: "未上架", sellerPpsn: "", nickname: "未知", profileCode: "", itemId: input };
    },

    async getPpsnByCode(profileCode) {
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        const json = await this.proxyFetch(url, true);
        if (json?.data?.ppsn) return json.data.ppsn;
        throw new Error("找不到該玩家");
    },

    async getEquipList(input) {
        let ppsn = input.trim();
        if (ppsn.length === 5 || ppsn.length === 6) {
            ppsn = await this.getPpsnByCode(ppsn);
        }

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);

        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES", "ONEHANDED_WEAPON", "TWOHANDED_WEAPON"];
        return (json?.data?.items || []).filter(item => whitelist.includes(item.avatarType));
    }
};

window.NexonAPI = NexonAPI;
