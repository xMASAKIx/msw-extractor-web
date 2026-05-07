/**
 * Nexon MSW API 整合模組
 * 修正：強化 Proxy 機制與 530 錯誤處理
 */
const NexonAPI = {
    RUNTIME_VERSION: "1.74.1", 
    // 優先使用 corsproxy.io，備用使用 allorigins
    PRIMARY_PROXY: "https://corsproxy.io/?",
    BACKUP_PROXY: "https://api.allorigins.win/raw?url=",

    /**
     * 通用的請求包裝，加入自動重試 Proxy 機制
     */
    async fetchViaProxy(targetUrl, options = {}, useBackup = false) {
        const proxy = useBackup ? this.BACKUP_PROXY : this.PRIMARY_PROXY;
        const finalUrl = proxy + encodeURIComponent(targetUrl);

        try {
            const response = await fetch(finalUrl, options);
            
            // 如果遇到 530 或其他代理錯誤，切換備用 Proxy 再試一次
            if ((response.status === 530 || !response.ok) && !useBackup) {
                console.warn("主要 Proxy 失敗 (530)，嘗試切換備用 Proxy...");
                return await this.fetchViaProxy(targetUrl, options, true);
            }
            
            return response;
        } catch (err) {
            if (!useBackup) return await this.fetchViaProxy(targetUrl, options, true);
            throw err;
        }
    },

    /**
     * 1. Profile Code 轉換為 PPSN
     */
    async getPpsnByCode(profileCode) {
        const targetUrl = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        
        try {
            const response = await this.fetchViaProxy(targetUrl);
            if (!response.ok) throw new Error("無法連接至轉換伺服器");
            
            const resData = await response.json();
            if (resData && resData.data && resData.data.ppsn) {
                return {
                    ppsn: resData.data.ppsn,
                    profileName: resData.data.profileName
                };
            } else {
                throw new Error("找不到該玩家 Code");
            }
        } catch (err) {
            throw new Error("ID 轉換失敗: " + err.message);
        }
    },

    /**
     * 2. 提取裝備清單
     */
    async getEquipList(ppsn) {
        const currentAccount = AccountManager.getCurrentAccount();
        if (!currentAccount || !currentAccount.token) {
            throw new Error("請先點選下方已儲存的帳號");
        }

        const targetUrl = `https://maplestoryworlds-api.nexon.com/api/v1/user/${ppsn}/avatar/equip-list`;
        
        const options = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'mod-accesstoken': currentAccount.token,
                'x-mod-runtime-version': this.RUNTIME_VERSION
            }
        };

        try {
            const response = await this.fetchViaProxy(targetUrl, options);

            if (response.status === 401) throw new Error("憑證已失效");
            if (!response.ok) throw new Error(`伺服器錯誤: ${response.status}`);

            const resData = await response.json();
            return (resData && resData.data && resData.data.items) ? resData.data.items : [];
        } catch (err) {
            throw new Error("裝備抓取失敗: " + err.message);
        }
    }
};
