/**
 * 帳號與憑證管理模組 (LocalStorage 版本 + JSON 匯入功能)
 */
const AccountManager = {
    STORAGE_KEY: 'msw_accounts_v1',

    // --- 新增：初始化匯入邏輯 ---
    initImportLogic() {
        const fileSelector = document.getElementById('file_selector');
        const btnImport = document.getElementById('btn_import');
        const importStatus = document.getElementById('import_status');

        if (!btnImport || !fileSelector) return;

        // 點擊按鈕觸發檔案選取
        btnImport.addEventListener('click', () => fileSelector.click());

        // 監聽檔案選取
        fileSelector.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // 根據你的結構：尋找 current_account 對應的資料
                    const currentId = data.current_account;
                    const accounts = data.accounts || [];
                    const activeAccount = accounts.find(acc => acc.user_id === currentId);

                    if (activeAccount) {
                        // 1. 自動填入輸入框
                        document.getElementById('token_input').value = activeAccount.access_token;
                        document.getElementById('userid_input').value = activeAccount.user_id;

                        // 2. 顯示狀態
                        if (importStatus) {
                            importStatus.innerText = `✅ 已讀取: ${activeAccount.nickname || activeAccount.user_id}`;
                            importStatus.style.display = 'block';
                        }

                        // 3. 自動儲存到 LocalStorage (選用)
                        this.saveAccount(activeAccount.user_id, activeAccount.access_token);
                        
                        console.log("JSON 匯入成功:", activeAccount.nickname);
                    } else {
                        alert('❌ JSON 內找不到目前啟用的帳號 (current_account)');
                    }
                } catch (err) {
                    console.error("解析失敗:", err);
                    alert('❌ 檔案讀取失敗，請確認是否為正確的 saved_accounts.json');
                }
                e.target.value = ''; // 重置，讓下次選同檔案也能觸發
            };
            reader.readAsText(file);
        });
    },

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
            accounts.unshift({ // 新帳號排在最前面
                userId: userId,
                token: token,
                lastUpdate: new Date().toISOString()
            });
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        this.renderAccountList(); // 儲存後立即更新介面
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
            <div class="account-item" style="cursor:pointer; margin-bottom: 8px; padding: 8px; background: #27272a; border-radius: 4px;" onclick="AccountManager.selectAccount('${acc.userId}')">
                <div style="font-weight: bold; color: #f4f4f5; font-size: 12px;">${acc.userId}</div>
                <div style="font-size: 10px; color: #71717a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
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
            
            const status = document.getElementById('import_status');
            if (status) status.style.display = 'none'; // 切換帳號時隱藏匯入提示
        }
    }
};

// 頁面載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    AccountManager.renderAccountList();
    AccountManager.initImportLogic(); // 啟動匯入邏輯

    // 綁定原本的儲存按鈕 (假設你的 HTML 裡有個儲存按鈕)
    const btnSave = document.getElementById('btn_save');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const userId = document.getElementById('userid_input').value;
            const token = document.getElementById('token_input').value;
            if (userId && token) {
                AccountManager.saveAccount(userId, token);
                alert('憑證已儲存至瀏覽器！');
            } else {
                alert('請先輸入或匯入帳號資料');
            }
        });
    }
});
