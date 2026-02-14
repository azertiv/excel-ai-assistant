import {
  Button,
  Caption1,
  Field,
  Input,
  Select,
  Slider,
  Switch,
  Text,
  makeStyles,
  tokens
} from "@fluentui/react-components";
import { useSettingsStore, tokenBudgetBounds } from "@/state/settingsStore";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground2
  },
  row: {
    display: "grid",
    gap: tokens.spacingVerticalXS
  },
  hint: {
    color: tokens.colorNeutralForeground3
  },
  inline: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  warning: {
    border: `1px solid ${tokens.colorPaletteMarigoldBorder2}`,
    background: tokens.colorPaletteMarigoldBackground2,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium
  }
});

export function SettingsPanel(): JSX.Element {
  const classes = useStyles();
  const { settings, setProvider, setModel, setApiKey, updateSettings, saveSettings } = useSettingsStore();

  const activeModel = settings.models[settings.provider];
  const activeKey = settings.apiKeys[settings.provider] ?? "";

  return (
    <aside className={classes.root}>
      <Text weight="semibold">Settings</Text>

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
              <option value="gemini-3-flash-lite">gemini-3-flash-lite</option>
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

      <div className={classes.row}>
        <div className={classes.inline}>
          <Switch
            checked={settings.approvalMode}
            onChange={(_, data) => {
              updateSettings({ approvalMode: data.checked });
            }}
            label={settings.approvalMode ? "Approval mode" : "Autonomous mode"}
          />
        </div>
        <Caption1 className={classes.hint}>Approval mode is ON by default for workbook edits.</Caption1>
      </div>

      <div className={classes.row}>
        <Switch
          checked={settings.webSearchEnabled}
          onChange={(_, data) => {
            updateSettings({ webSearchEnabled: data.checked });
          }}
          label="Web search enabled"
        />
        <Caption1 className={classes.hint}>Disabled by default. External calls require confirmation.</Caption1>
      </div>

      <Switch
        checked={settings.loggingEnabled}
        onChange={(_, data) => {
          updateSettings({ loggingEnabled: data.checked });
        }}
        label="Session logging to AI Log sheet"
      />

      <Field label={`Max token budget per request: ${settings.maxTokenBudget.toLocaleString()}`}>
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
      <Caption1 className={classes.hint}>Higher budget = more context + higher cost.</Caption1>

      <Field label="Risky write threshold (cells)">
        <Input
          value={String(settings.riskyWriteCellThreshold)}
          onChange={(_, data) => {
            updateSettings({ riskyWriteCellThreshold: Number(data.value) || 1 });
          }}
        />
      </Field>

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

      {settings.warnOnPromptInjection ? (
        <div className={classes.warning}>
          <Text size={200} weight="semibold">
            Security warning
          </Text>
          <Caption1>Spreadsheet text is untrusted input. Use only with trusted workbooks to reduce prompt injection risk.</Caption1>
        </div>
      ) : null}

      <Button
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
