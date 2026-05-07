/**
 * Nexon MSW API 整合模組
 * 修正：加入 Proxy 解決 Failed to fetch (CORS) 問題
 */
const NexonAPI = {
    RUNTIME_VERSION: "1.74.1", 
    // 使用 cors-anywhere 代理來繞過瀏覽器限制
    PROXY: "https://corsproxy.io/?",

    /**
     * 1. Profile Code 轉換為 PPSN
     */
    async getPpsnByCode(profileCode) {
        const targetUrl = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        // 將目標網址串在 Proxy 後面
        const url = this.PROXY + encodeURIComponent(targetUrl);
        
        try {
            const response = await fetch(url);
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
            console.error("getPpsnByCode 失敗:", err);
            throw err;
        }
    },

    /**
     * 2. 提取裝備清單
     */
    async getEquipList(ppsn) {
        // 從 AccountManager 取得當前存好的 Token
        const currentAccount = AccountManager.getCurrentAccount();
        
        if (!currentAccount || !currentAccount.token) {
            throw new Error("找不到憑證，請先點選下方已儲存的帳號");
        }

        const targetUrl = `https://maplestoryworlds-api.nexon.com/api/v1/user/${ppsn}/avatar/equip-list`;
        const url = this.PROXY + encodeURIComponent(targetUrl);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'mod-accesstoken': currentAccount.token,
                    'x-mod-runtime-version': this.RUNTIME_VERSION
                }
            });

            if (response.status === 401) throw new Error("憑證已失效，請重新抓取 Token");
            if (!response.ok) throw new Error(`伺服器回應錯誤: ${response.status}`);

            const resData = await response.json();
            return (resData && resData.data && resData.data.items) ? resData.data.items : [];
        } catch (err) {
            console.error("getEquipList 失敗:", err);
            throw err;
        }
    }
};
