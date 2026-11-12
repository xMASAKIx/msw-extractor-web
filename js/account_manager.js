/**
 * 帳號與憑證管理模組 (LocalStorage 版本 + 自動讀取 Windows 登錄檔 + JSON 匯入功能)
 */
const AccountManager = {
    STORAGE_KEY: 'msw_accounts_v1',

    // --- 新增：自動向本地代理伺服器請求 Windows 登錄檔的 Token ---
    async autoFetchRegistryToken() {
        try {
            const response = await fetch('http://localhost:3000/get-authtoken');
            const data = await response.json();

            if (data.token && data.user_id) {
                // 1. 自動填入輸入框
                const tokenInput = document.getElementById('token_input');
                const userIdInput = document.getElementById('userid_input');
                
                if (tokenInput) tokenInput.value = data.token;
                if (userIdInput) userIdInput.value = data.user_id;

                // 2. 顯示狀態提示
                const importStatus = document.getElementById('import_status');
                if (importStatus) {
                    importStatus.innerText = `✅ 已自動從 Windows 登錄檔帶入帳號`;
                    importStatus.style.display = 'block';
                }

                // 3. 自動幫你存進瀏覽器紀錄中（選用）
                this.saveAccount(data.user_id, data.token);

                console.log("成功從 Windows 登錄檔自動帶入 Token！");
            }
        } catch (err) {
            console.log("無法連線至本地代理伺服器（可能是手動模式或代理未開）", err);
        }
    },

    // --- 初始化匯入邏輯 (保留你原本的手動 JSON 讀取) ---
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
                    
                    const currentId = data.current_account;
                    const accounts = data.accounts || [];
                    const activeAccount = accounts.find(acc => acc.user_id === currentId);

                    if (activeAccount) {
                        document.getElementById('token_input').value = activeAccount.access_token;
                        document.getElementById('userid_input').value = activeAccount.user_id;

                        if (importStatus) {
                            importStatus.innerText = `✅ 已讀取: ${activeAccount.nickname || activeAccount.user_id}`;
                            importStatus.style.display = 'block';
                        }

                        this.saveAccount(activeAccount.user_id, activeAccount.access_token);
                        console.log("JSON 匯入成功:", activeAccount.nickname);
                    } else {
                        alert('❌ JSON 內找不到目前啟用的帳號 (current_account)');
                    }
                } catch (err) {
                    console.error("解析失敗:", err);
                    alert('❌ 檔案讀取失敗，請確認是否為正確的 saved_accounts.json');
                }
                e.target.value = ''; 
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
        
        const index = accounts.findIndex(acc => acc.userId === userId);
        if (index !== -1) {
            accounts[index].token = token;
            accounts[index].lastUpdate = new Date().toISOString();
        } else {
            accounts.unshift({ 
                userId: userId,
                token: token,
                lastUpdate: new Date().toISOString()
            });
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
        this.renderAccountList(); 
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
            if (status) status.style.display = 'none'; 
        }
    }
};

// 頁面載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    AccountManager.renderAccountList();
    AccountManager.initImportLogic(); // 啟動原本的 JSON 手動匯入邏輯
    
    // ★ 啟動時自動向代理伺服器索取 Windows 登錄檔的 Token
    AccountManager.autoFetchRegistryToken();

    // 綁定原本的儲存按鈕
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
