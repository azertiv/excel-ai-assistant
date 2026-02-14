import { Button, Caption1, Field, Input, Select, Slider, Switch, Text } from "@fluentui/react-components";
import { tokenBudgetBounds, useSettingsStore } from "@/state/settingsStore";

export function SettingsPanel(): JSX.Element {
  const { settings, setProvider, setModel, setApiKey, updateSettings, saveSettings } = useSettingsStore();

  const activeModel = settings.models[settings.provider];
  const activeKey = settings.apiKeys[settings.provider] ?? "";

  return (
    <aside className="settings-panel">
      <div className="settings-head">
        <Text weight="semibold">Control Center</Text>
        <Caption1>Runtime and safety configuration</Caption1>
      </div>

      <section className="settings-section">
        <Text weight="semibold" size={300}>
          Provider
        </Text>

        <Field label="Provider">
          <Select
            value={settings.provider}
            onChange={(_, data) => {
              setProvider(data.value as typeof settings.provider);
            }}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </Select>
        </Field>

        <Field label="Model">
          <Select
            value={activeModel}
            onChange={(_, data) => {
              setModel(settings.provider, data.value);
            }}
          >
            {settings.provider === "gemini" ? (
              <>
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                <option value={activeModel}>{activeModel}</option>
              </>
            ) : (
              <option value={activeModel}>{activeModel}</option>
            )}
          </Select>
        </Field>

        <Field label="Custom model id">
          <Input
            value={activeModel}
            onChange={(_, data) => {
              setModel(settings.provider, data.value);
            }}
          />
        </Field>

        <Field label={`${settings.provider.toUpperCase()} API key (BYO)`}>
          <Input
            type="password"
            value={activeKey}
            onChange={(_, data) => {
              setApiKey(settings.provider, data.value);
            }}
          />
        </Field>
      </section>

      <section className="settings-section">
        <Text weight="semibold" size={300}>
          Safety
        </Text>

        <Switch
          checked={settings.approvalMode}
          onChange={(_, data) => {
            updateSettings({ approvalMode: data.checked });
          }}
          label={settings.approvalMode ? "Approval mode" : "Autonomous mode"}
        />

        <Switch
          checked={settings.webSearchEnabled}
          onChange={(_, data) => {
            updateSettings({ webSearchEnabled: data.checked });
          }}
          label="Web search enabled"
        />

        <Switch
          checked={settings.loggingEnabled}
          onChange={(_, data) => {
            updateSettings({ loggingEnabled: data.checked });
          }}
          label="Log each turn to AI Log sheet"
        />

        <Field label="Risky write threshold (cells)">
          <Input
            value={String(settings.riskyWriteCellThreshold)}
            onChange={(_, data) => {
              updateSettings({ riskyWriteCellThreshold: Number(data.value) || 1 });
            }}
          />
        </Field>
      </section>

      <section className="settings-section">
        <Text weight="semibold" size={300}>
          Token Budget
        </Text>

        <Field label={`Max token budget: ${settings.maxTokenBudget.toLocaleString()}`}>
          <Slider
            min={tokenBudgetBounds.min}
            max={tokenBudgetBounds.max}
            step={1000}
            value={settings.maxTokenBudget}
            onChange={(_, data) => {
              updateSettings({ maxTokenBudget: data.value });
            }}
          />
        </Field>
        <Caption1>Higher budget = more context + higher cost.</Caption1>
      </section>

      <section className="settings-section">
        <Text weight="semibold" size={300}>
          Network
        </Text>

        <Field label="Proxy base URL (optional)">
          <Input
            value={settings.proxyBaseUrl}
            onChange={(_, data) => {
              updateSettings({ proxyBaseUrl: data.value });
            }}
            placeholder="https://your-proxy.example.com"
          />
        </Field>

        <Switch
          checked={settings.proxyEnabled}
          onChange={(_, data) => {
            updateSettings({ proxyEnabled: data.checked });
          }}
          label="Use proxy mode"
        />

        <Field label="Search endpoint (optional)">
          <Input
            value={settings.searchEndpoint}
            onChange={(_, data) => {
              updateSettings({ searchEndpoint: data.value });
            }}
            placeholder="https://your-search.example.com/search"
          />
        </Field>
      </section>

      {settings.warnOnPromptInjection ? (
        <div className="settings-warning">
          <Text size={200} weight="semibold">
            Prompt injection warning
          </Text>
          <Caption1>Only use with trusted spreadsheets. Sheet content can contain hostile instructions.</Caption1>
        </div>
      ) : null}

      <Button
        className="settings-save-btn"
        appearance="primary"
        onClick={() => {
          void saveSettings();
        }}
      >
        Save settings
      </Button>
    </aside>
  );
}
