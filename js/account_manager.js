/**
 * 帳號管理模組 (AccountManager)
 * 負責處理多帳號保存、切換以及 LocalStorage 持久化
 */

const AccountManager = {
    // 儲存帳號列表的 Key
    STORAGE_KEY: 'msw_saved_accounts',
    CURRENT_ID_KEY: 'msw_current_user_id',

    // 取得所有已儲存的帳號
    getAccounts() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // 保存帳號資訊 (對應 save_current_account)
    saveAccount(userId, token, nickname = "") {
        if (!userId || !token) return false;

        let accounts = this.getAccounts();
        const existingIndex = accounts.findIndex(a => a.userId === userId);
        
        const accountData = {
            userId: userId,
            token: token,
            nickname: nickname || `帳號 (...${userId.slice(-6)})`,
            lastUpdated: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            accounts[existingIndex] = accountData;
        } else {
            accounts.push(accountData);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        this.setCurrentAccount(userId);
        return true;
    },

    // 切換當前活動帳號 (對應 switch_to_account)
    setCurrentAccount(userId) {
        const accounts = this.getAccounts();
        const account = accounts.find(a => a.userId === userId);
        
        if (account) {
            localStorage.setItem(this.CURRENT_ID_KEY, userId);
            localStorage.setItem('msw_token', account.token);
            localStorage.setItem('msw_user_id', account.userId);
            
            // 觸發事件讓 UI 更新 (類似 Godot 的 token_changed 訊號)
            window.dispatchEvent(new Event('msw_account_changed'));
            return true;
        }
        return false;
    },

    // 獲取當前帳號資訊
    getCurrentAccount() {
        const userId = localStorage.getItem(this.CURRENT_ID_KEY);
        if (!userId) return null;
        return this.getAccounts().find(a => a.userId === userId);
    },

    // 移除帳號
    removeAccount(userId) {
        let accounts = this.getAccounts();
        accounts = accounts.filter(a => a.userId !== userId);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        
        if (localStorage.getItem(this.CURRENT_ID_KEY) === userId) {
            localStorage.removeItem(this.CURRENT_ID_KEY);
            localStorage.removeItem('msw_token');
            localStorage.removeItem('msw_user_id');
        }
    }
};

// 匯出模組
window.AccountManager = AccountManager;
