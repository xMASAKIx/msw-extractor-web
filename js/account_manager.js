/**
 * 帳號與憑證管理模組 (LocalStorage 版本)
 */
const AccountManager = {
    STORAGE_KEY: 'msw_accounts_v1',

    // 取得所有儲存的帳號
    getAllAccounts() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // 儲存單一帳號
    saveAccount(userId, token) {
        let accounts = this.getAllAccounts();
        
        // 檢查是否已存在同 ID 帳號，有的話就更新
        const index = accounts.findIndex(acc => acc.userId === userId);
        if (index !== -1) {
            accounts[index].token = token;
            accounts[index].lastUpdate = new Date().toISOString();
        } else {
            accounts.push({
                userId: userId,
                token: token,
                lastUpdate: new Date().toISOString()
            });
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        this.renderAccountList(); // 儲存後立即更新介面
    },

    // 取得目前選中的帳號 (預設取最後一個更新的)
    getCurrentAccount() {
        const accounts = this.getAllAccounts();
        return accounts.length > 0 ? accounts[0] : null;
    },

    // 渲染右側清單介面
    renderAccountList() {
        const listContainer = document.getElementById('saved_accounts_list');
        if (!listContainer) return;

        const accounts = this.getAllAccounts();
        if (accounts.length === 0) {
            listContainer.innerHTML = '<p style="color: #52525b; font-size: 12px; text-align: center;">尚無儲存帳號</p>';
            return;
        }

        listContainer.innerHTML = accounts.map(acc => `
            <div class="account-item" onclick="AccountManager.selectAccount('${acc.userId}')">
                <div style="font-weight: bold; color: #f4f4f5;">${acc.userId}</div>
                <div style="font-size: 10px; color: #71717a; overflow: hidden; text-overflow: ellipsis;">
                    ${acc.token.substring(0, 20)}...
                </div>
            </div>
        `).join('');
    },

    // 選中帳號 (自動填入輸入框)
    selectAccount(userId) {
        const accounts = this.getAllAccounts();
        const acc = accounts.find(a => a.userId === userId);
        if (acc) {
            document.getElementById('token_input').value = acc.token;
            document.getElementById('userid_input').value = acc.userId;
            alert(`已選取帳號: ${userId}`);
        }
    }
};

// 頁面載入完成後執行第一次渲染
document.addEventListener('DOMContentLoaded', () => {
    AccountManager.renderAccountList();
});
