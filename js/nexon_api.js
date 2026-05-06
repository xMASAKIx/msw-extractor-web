/**
 * MSW Nexon API 核心模組
 * 整合了 Godot 版本中的 Token 管理與過濾邏輯
 */

const NexonAPI = {
    // 預設請求頭配置
    getHeaders: () => {
        return {
            "mod-accesstoken": localStorage.getItem('msw_token'),
            "mod-user-id": localStorage.getItem('msw_user_id'),
            "x-mod-client": "727d112f1370415e85686530ec048fb7",
            "x-mod-runtime-version": "1.25.6.672",
            "x-mod-client-platform": "win",
            "mod-caller": "mod",
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
    },

    // 封裝 Fetch 邏輯（含 CORS 代理）
    async proxyFetch(url) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            headers: this.getHeaders()
        });

        if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
        }
        if (!response.ok) {
            throw new Error(`HTTP_ERROR_${response.status}`);
        }
        return await response.json();
    },

    /**
     * 1. 獲取玩家穿戴裝備清單 (對應 _on_player_equip_loaded)
     */
    async getEquipList(ppsn) {
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mverse/v1/shop/mod/inventory/avatars/manage/equip/list/${ppsn}`;
        const json = await this.proxyFetch(url);
        
        // 裝備類型白名單 (對應 Godot 中的邏輯)
        const whitelist = ["HAIR", "HAT", "CAPE", "TOP", "GLOVE", "OVERALL", "BOTTOM", "SHOES"];
        
        return (json.data?.items || []).filter(item => 
            whitelist.includes(item.avatarType)
        );
    },

    /**
     * 2. 獲取好友名單 (對應 _load_player_friends)
     */
    async getFriends(ppsn) {
        const url = `https://mverse-api.nexon.com/social/v1/${ppsn}/friends?size=200`;
        const json = await this.proxyFetch(url);
        return json.data?.result || [];
    },

    /**
     * 3. 獲取資產 Metadata (對應 _download_mod_file)
     * 用於取得 .mod 檔案的 CDN 路徑
     */
    async getAssetMetadata(ruid) {
        const url = `https://mod-gateway-prd-tokyo-2.nexon.com/mod/v1/asset/metadata/${ruid}`;
        return await this.proxyFetch(url);
    },

    /**
     * 4. 驗證圖片 Buffer (對應 _load_extractor_image)
     * 網頁版雖然 img 標籤能自動解析，但若要下載提取則需要這個驗證
     */
    checkImageFormat(buffer) {
        const view = new Uint8Array(buffer);
        // PNG: 137 80 78 71
        if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47) return "png";
        // JPG: 255 216
        if (view[0] === 0xFF && view[1] === 0xD8) return "jpg";
        // WEBP: RIFF...WEBP
        if (view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) return "webp";
        return "unknown";
    }
};

// 匯出模組供 admin.html 使用
window.NexonAPI = NexonAPI;
