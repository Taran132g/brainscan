import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  requestUrl,
} from "obsidian";
import JSZip from "jszip";

interface BrainScanSettings {
  apiBaseUrl: string;
  token: string;
  excludeFolders: string; // comma-separated path prefixes
}

const DEFAULT_SETTINGS: BrainScanSettings = {
  apiBaseUrl: "https://api.129.159.182.210.nip.io",
  token: "",
  excludeFolders: "",
};

export default class BrainScanPlugin extends Plugin {
  settings: BrainScanSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "scan-my-brain",
      name: "Scan my brain",
      callback: () => this.scanMyBrain(),
    });

    this.addRibbonIcon("brain", "BrainScan: Scan my brain", () => this.scanMyBrain());
    this.addSettingTab(new BrainScanSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Markdown files the user hasn't excluded. */
  private collectFiles(): TFile[] {
    const excludes = this.settings.excludeFolders
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return this.app.vault.getMarkdownFiles().filter((f) => {
      return !excludes.some((p) => f.path === p || f.path.startsWith(p.replace(/\/?$/, "/")));
    });
  }

  async scanMyBrain() {
    if (!this.settings.token) {
      new Notice("Connect your BrainScan account first (plugin settings).");
      // @ts-ignore - open this plugin's settings tab
      this.app.setting?.open?.();
      return;
    }

    const files = this.collectFiles();
    if (files.length === 0) {
      new Notice("No notes to scan (check your exclude-folders setting).");
      return;
    }

    // Privacy: show exactly what's about to leave the vault, get explicit consent.
    let totalBytes = 0;
    const contents: { path: string; data: string }[] = [];
    for (const f of files) {
      const data = await this.app.vault.read(f);
      totalBytes += data.length;
      contents.push({ path: f.path, data });
    }

    const ok = await new Promise<boolean>((resolve) => {
      new ConfirmModal(
        this.app,
        files.length,
        totalBytes,
        this.settings.apiBaseUrl,
        resolve
      ).open();
    });
    if (!ok) return;

    const notice = new Notice("BrainScan: zipping your vault…", 0);
    try {
      const zip = new JSZip();
      for (const c of contents) zip.file(c.path, c.data);
      const body = await zip.generateAsync({ type: "arraybuffer" });

      notice.setMessage("BrainScan: uploading…");
      const view = await this.uploadVault(body);

      notice.hide();
      new Notice("✅ Brain scan ready — opening BrainScan.");
      window.open(view, "_blank");
    } catch (e: any) {
      notice.hide();
      new Notice(`BrainScan failed: ${e?.message || e}`);
      console.error("[BrainScan] scan failed", e);
    }
  }

  /** POST the zip to /api/plugin/scan via requestUrl (bypasses renderer CORS). */
  private async uploadVault(zip: ArrayBuffer): Promise<string> {
    const boundary = "----BrainScan" + Math.random().toString(16).slice(2);
    const enc = new TextEncoder();
    const pre = enc.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="vault.zip"\r\n` +
        `Content-Type: application/zip\r\n\r\n`
    );
    const post = enc.encode(`\r\n--${boundary}--\r\n`);
    const payload = new Uint8Array(pre.length + zip.byteLength + post.length);
    payload.set(pre, 0);
    payload.set(new Uint8Array(zip), pre.length);
    payload.set(new Uint8Array(post.buffer ?? post), pre.length + zip.byteLength);

    const base = this.settings.apiBaseUrl.replace(/\/?$/, "");
    const res = await requestUrl({
      url: `${base}/api/plugin/scan`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: payload.buffer,
      throw: false,
    });

    if (res.status === 401) {
      throw new Error("token rejected — reconnect in settings.");
    }
    if (res.status === 402) {
      throw new Error("payment required — open BrainScan to unlock scanning.");
    }
    if (res.status < 200 || res.status >= 300) {
      const detail = (res.json && (res.json.detail?.message || res.json.detail)) || res.text;
      throw new Error(`server ${res.status}: ${String(detail).slice(0, 160)}`);
    }
    return (res.json && res.json.view_url) || `${base}`;
  }
}

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private fileCount: number,
    private totalBytes: number,
    private apiBaseUrl: string,
    private resolve: (ok: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Scan your brain?" });
    const kb = Math.round(this.totalBytes / 1024);
    contentEl.createEl("p", {
      text: `${this.fileCount} notes (${kb} KB) will be sent to BrainScan to generate your brain card. You'll view the result on the BrainScan site.`,
    });
    contentEl.createEl("p", {
      cls: "mod-warning",
      text: "Exclude private folders in plugin settings if you don't want them included.",
    });

    const row = contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.resolve(false);
      this.close();
    };
    const go = row.createEl("button", { text: "Scan", cls: "mod-cta" });
    go.onclick = () => {
      this.resolve(true);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

class BrainScanSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BrainScanPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "BrainScan" });

    containerEl.createEl("p", {
      text: "Connect your account: open BrainScan → Settings → Connect Obsidian, copy the token, and paste it below.",
    });

    new Setting(containerEl)
      .setName("Personal token")
      .setDesc("Links this vault to your BrainScan account. Shown once when you connect.")
      .addText((t) =>
        t
          .setPlaceholder("paste your token")
          .setValue(this.plugin.settings.token)
          .onChange(async (v) => {
            this.plugin.settings.token = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API base URL")
      .setDesc("Leave as-is unless you're self-hosting.")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (v) => {
            this.plugin.settings.apiBaseUrl = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("Comma-separated path prefixes to never send (e.g. Private/, Journal/).")
      .addText((t) =>
        t
          .setPlaceholder("Private/, Journal/")
          .setValue(this.plugin.settings.excludeFolders)
          .onChange(async (v) => {
            this.plugin.settings.excludeFolders = v;
            await this.plugin.saveSettings();
          })
      );
  }
}
