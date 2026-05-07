/**
 * Nexon MSW API 通訊模組
 */
const NexonAPI = {
    // MSW API 基礎設定
    // 注意：如果 API 報錯，可能需要更新此版本號
    RUNTIME_VERSION: "1.74.1", 

    /**
     * 第一步：將 5 碼 Profile Code 轉換為 17 碼 PPSN
     * 對接 mverse-api (如同 Godot 腳本中的功能)
     */
    async getPpsnByCode(profileCode) {
        console.log(`🌐 正在查詢 Profile Code: ${profileCode}`);
        const url = `https://mverse-api.nexon.com/profile/v1/profileCode/${profileCode}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("無法連接到 Profile API");
            
            const resData = await response.json();
            
            // 檢查回傳資料結構
            if (resData && resData.data && resData.data.ppsn) {
                console.log(`✅ 轉換成功: ${resData.data.profileName} -> ${resData.data.ppsn}`);
                return {
                    ppsn: resData.data.ppsn,
                    name: resData.data.profileName,
                    fullData: resData.data
                };
            } else {
                throw new Error("找不到該玩家 ID，請檢查 Code 是否正確");
            }
        } catch (err) {
            console.error("getPpsnByCode 錯誤:", err);
            throw err;
        }
    },

    /**
     * 第二步：使用 PPSN 抓取該玩家穿戴中的裝備
     * 需要 Access Token (從 AccountManager 取得)
     */
    async getEquipList(ppsn) {
        // 從 AccountManager 獲取目前儲存的 Token
        const currentAccount = AccountManager.getCurrentAccount();
        if (!currentAccount || !currentAccount.token) {
            throw new Error("請先匯入或設定有效憑證 (Token)");
        }

        const url = `https://maplestoryworlds-api.nexon.com/api/v1/user/${ppsn}/avatar/equip-list`;

        console.log(`📦 正在提取裝備資料, PPSN: ${ppsn}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'mod-accesstoken': currentAccount.token,
                    'x-mod-runtime-version': this.RUNTIME_VERSION
                }
            });

            if (response.status === 401) {
                throw new Error("UNAUTHORIZED"); // Token 失效
            }

            if (!response.ok) {
                throw new Error(`伺服器回應錯誤: ${response.status}`);
            }

            const resData = await response.json();

            // 回傳裝備列表
            // 資料路徑通常在 resData.data.items
            if (resData && resData.data && resData.data.items) {
                return resData.data.items;
            } else {
                return []; // 無裝備
            }
        } catch (err) {
            console.error("getEquipList 錯誤:", err);
            throw err;
        }
    }
};
