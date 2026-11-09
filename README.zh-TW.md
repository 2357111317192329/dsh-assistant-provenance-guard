# dsh-assistant-provenance-guard

一個採用 fail-closed 策略的 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/DeepSeek-Harness)外掛：當 assistant 回應冒充 system、developer、user 或 goal 訊息時，在任何工具呼叫執行前隔離整份回應。

[English](README.md)

## 解決的問題

部分模型會在 reasoning 或可見回答中自行產生看似 Harness 訊息的文字，並在後續步驟把自己先前產生的文字當成真實指示。單靠 system prompt 無法可靠阻止這種模型退化。

本外掛不降低檔案、Shell 或編輯權限；它驗證模型輸出來源，而不是限制工具能力。

## 強制機制

```text
模型串流 → 完整緩衝 → 檢查 reasoning 與 text → 寫入會話 → 執行工具
```

- 回應通過檢查前，不向 DSH agent loop 釋出任何 chunk。
- reasoning 與可見文字都會檢查，並能辨識跨 chunk 的標記。
- 不掃描工具參數，因此經授權的工作仍能把保留語法寫入原始碼、測試或文件。
- 違規回應會被替換成 `ASSISTANT_PROVENANCE_VIOLATION` 錯誤，只留下 `assistant/attempt`，不會成為 `assistant/message`；其中的工具呼叫不會執行，也不會進入後續模型歷史。
- 預設最多重試兩次；持續違規時停止該回合，即使其他外掛配置了無限重試也不放行。
- 額外注入精簡的 system prompt 作為縱深防禦；真正的強制措施仍是執行期隔離。

內建規則涵蓋 DSH system reminder、goal round、常見 system/developer/user 角色包裝，以及英文／中文的「收到新使用者訊息」模板。比對前會先做 Unicode 相容正規化並移除零寬格式字元。

## 安裝

### 桌面版

開啟「插件 → 添加插件」，填入 GitHub 倉庫網址或本資料夾的絕對路徑，安裝後重新啟動 DSH。

### CLI profile

```bash
dsh plugin --profile <profile> add <本資料夾絕對路徑或 GitHub 倉庫>
```

倉庫直接包含可執行 JavaScript，沒有安裝期建置腳本或執行期相依套件。

## 設定

```yaml
- id: assistant-provenance-guard
  name: dsh-assistant-provenance-guard
  config:
    enabled: true
    injectPrompt: true
    inspectText: true
    inspectReasoning: true
    maxRetries: 2
    maxBufferedBytes: 4194304
    includeNonAgentRequests: false
    providers: []
    models: []
    additionalSignatures: []
```

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `enabled` | `true` | 啟用強制防護。 |
| `injectPrompt` | `true` | 將協議完整性指示加入 system prompt。 |
| `inspectText` | `true` | 檢查可見回答。 |
| `inspectReasoning` | `true` | 檢查 reasoning；對會輸出 reasoning 的模型不應關閉。 |
| `maxRetries` | `2` | 發現來源偽造後的自動重試次數（`0` 至 `10`）。 |
| `maxBufferedBytes` | `4194304` | 回應緩衝上限（`1024` 至 `67108864`）；超限即拒絕。 |
| `includeNonAgentRequests` | `false` | 是否連沒有 DSH session id 的輔助模型請求也一起防護。 |
| `providers` | `[]` | provider 精確白名單；空陣列代表全部。 |
| `models` | `[]` | model 精確白名單；空陣列代表全部。 |
| `additionalSignatures` | `[]` | 額外拒絕的文字，採不分大小寫的字面比對。 |

未知欄位、拼錯欄位或不合法值會在外掛載入時直接報錯，不會靜默降低保護。

## 取捨與限制

- 嚴格模式必須等完整回應檢查完才顯示，因此不再即時逐 token 顯示。若提前釋出 chunk，就無法保證整份回應與工具呼叫都被隔離。
- assistant 的 reasoning/text 即使只是引用保留角色語法也會被拒絕；一般說明請改用跳脫寫法。工具參數仍可寫入精確測試資料。
- 本外掛能阻止結構化角色冒充，但任何輸出過濾器都無法證明模型的所有自然語言判斷為真。專案仍應使用版本控制並檢查異常的大範圍修改。
- 外掛不會改寫既有污染會話。應從核對過的摘要建立乾淨新會話，否則模型可能不再輸出標記，直接服從歷史中的假訊息。

## 開發與驗證

```bash
npm test
npm run check
```

測試只使用 Node.js 內建 test runner。

## 授權

MIT
