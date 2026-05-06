import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        # 開啟瀏覽器 (headless=False 讓你看得到畫面)
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        print("🚀 正在開啟 Nexon 登入頁面...")
        await page.goto("https://maplestoryworlds.nexon.com/")

        print("👉 請在瀏覽器中完成登入動作...")
        
        # 等待使用者登入成功（這裡監控 localStorage 或是特定 API 出現）
        while True:
            # 檢查 localStorage 裡是否有 token
            token = await page.evaluate("localStorage.getItem('mod-accesstoken')")
            user_id = await page.evaluate("localStorage.getItem('mod-user-id')")
            
            if token and user_id:
                print("\n✅ 成功抓取 Token！")
                print(f"User ID: {user_id}")
                print(f"Access Token: {token[:30]}...")
                
                # 你可以讓它自動存成一個可以用於網頁匯入的 JSON
                with open("msw_token.json", "w") as f:
                    f.write(f'{{"user_id": "{user_id}", "token": "{token}"}}')
                
                print("\n💾 已儲存至 msw_token.json")
                break
            
            await asyncio.sleep(2)

        print("程序結束，可以關閉瀏覽器。")
        await browser.close()

asyncio.run(run())
