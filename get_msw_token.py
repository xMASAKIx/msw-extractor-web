import json
import os

# 定義檔案路徑
JSON_PATH = r"C:\Users\admin\AppData\Roaming\Godot\app_userdata\CY_WCNM\saved_accounts.json"

def get_current_credential():
    if not os.path.exists(JSON_PATH):
        print(f"❌ 找不到路徑: {JSON_PATH}")
        return

    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        current_id = data.get("current_account")
        accounts = data.get("accounts", [])
        
        # 在列表中尋找與 current_account 匹配的資料
        target_account = next((acc for acc in accounts if acc["user_id"] == current_id), None)

        if target_account:
            print(f"✨ 偵測到當前帳號: {target_account['nickname']}")
            print(f"🆔 User ID: {target_account['user_id']}")
            print(f"🔑 Token: {target_account['access_token'][:15]}...")
            
            # 輸出成網頁端可用的格式
            result = {
                "user_id": target_account['user_id'],
                "access_token": target_account['access_token']
            }
            
            with open("msw_token.json", "w", encoding='utf-8') as f:
                json.dump(result, f, indent=4)
            print("\n✅ 已將當前憑證存入 msw_token.json")
        else:
            print("⚠️ 找不到與 current_account 匹配的帳號資料")

    except Exception as e:
        print(f"❌ 讀取失敗: {e}")

if __name__ == "__main__":
    get_current_credential()
