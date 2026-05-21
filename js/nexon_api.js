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

// ... 前面的 getHeaders, proxyFetch 保持不變 ...

    // 新增：透過 PPSN 獲取詳細個人資料（含 5 碼 ID）
    async getProfileDetail(ppsn) {
        if (!ppsn || ppsn === "N/A") return null;
        const url = `https://mverse-api.nexon.com/social/v1/profile/${ppsn}`;
        const res = await this.proxyFetch(url, true); // 使用 Profile 模式請求
        return res?.data || null;
    },

    async getRealProductDetail(input) {
        let url;
        const isId = /^[A-Z0-9]{8,9}$/.test(input);

        if (isId) {
            url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/${input}`;
        } else {
            // 搜尋時加入亂數標籤，強制 Nexon 伺服器回傳最新結果
            url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/sale/avatars/search?sort=1&filterType=ALL&registeredType=CREATOR&size=1&searchAvatarName=${encodeURIComponent(input)}&_cb=${Date.now()}`;
        }

        try {
            const res = await this.proxyFetch(url);
            // 這裡要相容不同的資料結構
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
        // 如果商城完全搜不到，至少回傳一個帶有 ID 的基本物件，避免畫面壞掉
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
        if (ppsn.length === 5) ppsn = await this.getPpsnByCode(ppsn);

        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        return (json?.data?.items || []).filter(item => whitelist.includes(item.avatarType));
    },
    // 新增：利用賣家的 PPSN 撈取他上架的所有商品列表
    async function getSellerProducts(sellerPpsn) {
        // 這裡使用 Nexon 商店的搜尋接口，將 sellerPpsn 帶入查詢
        const url = `https://mverse-api.nexon.com/marketplace/v1/products/search?keyword=${sellerPpsn}&page=1&size=60&sortType=LATEST&avatarType=`;
        
        // 取得你儲存在網頁中的 Token
        const savedAccounts = localStorage.getItem('msw_accounts_v1');
        let token = "";
        if (savedAccounts) {
            try {
                const accounts = JSON.parse(savedAccounts);
                if (accounts.length > 0) token = accounts[0].token || '';
            } catch(e) { console.error(e); }
        }
    
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": token ? `Bearer ${token.trim()}` : "",
                "Accept": "application/json"
            }
        });
    
        if (!response.ok) {
            throw new Error(`無法撈取賣家商品商店 (錯誤碼: ${response.status})`);
        }
    
        const json = await response.json();
        // Nexon 搜尋回傳的商品列表通常在 data.products 或 items 裡面，根據實際結構返回陣列
        return json.data?.products || json.data?.items || [];
    }
};

window.NexonAPI = {
    getSellerProducts: getSellerProducts
};
