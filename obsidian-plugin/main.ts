import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  requestUrl,
  setIcon,
} from "obsidian";
import JSZip from "jszip";

/** Shared BrainScan brand banner — emerald mark + wordmark, used by the modal
 *  and the settings tab so both surfaces read as one product. */
function renderBrandBanner(parent: HTMLElement, tag: string): void {
  const banner = parent.createDiv({ cls: "bs-banner" });
  const row = banner.createDiv({ cls: "bs-banner-row" });
  row.createDiv({ cls: "bs-mark", text: "BS" });
  row.createDiv({ cls: "bs-wordmark", text: "BrainScan" });
  row.createDiv({ cls: "bs-tag", text: tag });
}

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
  private styleEl: HTMLStyleElement | null = null;

  async onload() {
    await this.loadSettings();
    this.injectStyles();

    this.addCommand({
      id: "scan-my-brain",
      name: "Scan my brain",
      callback: () => this.scanMyBrain(),
    });

    this.addRibbonIcon("brain", "BrainScan: Scan my brain", () => this.scanMyBrain());
    this.addSettingTab(new BrainScanSettingTab(this.app, this));
  }

  onunload() {
    this.styleEl?.remove();
    this.styleEl = null;
  }

  /** Brand the consent modal + settings to match the BrainScan web aesthetic
   *  (emerald-on-navy, liquid-chrome accents). Scoped under .brainscan-ui so it
   *  never bleeds into the rest of Obsidian. */
  private injectStyles() {
    const css = `
.brainscan-ui { --bs-accent: #10b981; --bs-accent-2: #34d399; --bs-violet: #8b5cf6; }

.brainscan-modal .modal-content,
.brainscan-modal.modal-content { padding: 0; }

.bs-banner {
  position: relative;
  overflow: hidden;
  margin: -20px -20px 18px;
  padding: 22px 24px;
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(52,211,153,0.30), transparent 60%),
    radial-gradient(120% 160% at 0% 120%, rgba(139,92,246,0.22), transparent 55%),
    #0a0e18;
  border-bottom: 1px solid rgba(148,163,184,0.18);
}
.bs-banner-row { display: flex; align-items: center; gap: 11px; }
.bs-mark {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; letter-spacing: -0.02em; color: #04130d;
  background: linear-gradient(135deg, #34d399, #10b981 55%, #a7f3d0);
  box-shadow: 0 4px 16px -4px rgba(16,185,129,0.6);
}
.bs-wordmark { font-weight: 700; font-size: 16px; color: #f3f6fb; letter-spacing: -0.01em; }
.bs-tag { margin-left: auto; font-size: 12px; color: #93a1b8; }

.brainscan-modal h2.bs-title {
  margin: 2px 0 6px; font-size: 21px; letter-spacing: -0.02em; color: var(--text-normal);
}
.bs-sub { margin: 0 0 16px; color: var(--text-muted); font-size: 13.5px; line-height: 1.55; }

.bs-stats { display: flex; gap: 10px; margin: 0 0 16px; }
.bs-stat {
  flex: 1; padding: 12px 14px; border-radius: 11px;
  background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
}
.bs-stat-num { font-size: 20px; font-weight: 800; color: var(--bs-accent-2); letter-spacing: -0.01em; }
.bs-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-top: 2px; }

.bs-note {
  display: flex; gap: 9px; align-items: flex-start;
  padding: 11px 13px; border-radius: 10px; font-size: 12.5px; line-height: 1.5;
  color: var(--text-muted);
  background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.22);
}
.bs-note svg { flex: 0 0 auto; margin-top: 1px; color: #fbbf24; }

.brainscan-modal .modal-button-container { margin-top: 20px; }
.brainscan-modal .bs-cta {
  background: linear-gradient(135deg, #34d399, #10b981 60%, #059669) !important;
  color: #04130d !important; font-weight: 700;
  box-shadow: 0 6px 20px -6px rgba(16,185,129,0.55);
}
.brainscan-modal .bs-cta:hover { filter: brightness(1.06); }

.brainscan-settings .bs-banner { margin: 0 0 18px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.18); }
.brainscan-settings .bs-sub { margin-bottom: 4px; }
`;
    this.styleEl = document.createElement("style");
    this.styleEl.id = "brainscan-styles";
    this.styleEl.textContent = css;
    document.head.appendChild(this.styleEl);
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
    contentEl.addClass("brainscan-ui", "brainscan-modal");

    renderBrandBanner(contentEl, "Brain Card");

    contentEl.createEl("h2", { text: "Scan your brain?", cls: "bs-title" });
    contentEl.createEl("p", {
      cls: "bs-sub",
      text: "BrainScan reads your notes into a Brain Card — an honest read of how you think, what drives you, and how you connect. Here's exactly what's about to leave your vault:",
    });

    const kb = Math.round(this.totalBytes / 1024);
    const stats = contentEl.createDiv({ cls: "bs-stats" });
    const notes = stats.createDiv({ cls: "bs-stat" });
    notes.createDiv({ cls: "bs-stat-num", text: String(this.fileCount) });
    notes.createDiv({ cls: "bs-stat-label", text: this.fileCount === 1 ? "note" : "notes" });
    const size = stats.createDiv({ cls: "bs-stat" });
    size.createDiv({ cls: "bs-stat-num", text: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` });
    size.createDiv({ cls: "bs-stat-label", text: "uploaded" });

    const note = contentEl.createDiv({ cls: "bs-note" });
    const icon = note.createSpan();
    setIcon(icon, "shield-alert");
    note.createSpan({
      text: "Exclude private folders (Journal, etc.) in plugin settings if you don't want them included.",
    });

    const row = contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.resolve(false);
      this.close();
    };
    const go = row.createEl("button", { text: "Scan my brain", cls: "mod-cta bs-cta" });
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
    containerEl.addClass("brainscan-ui", "brainscan-settings");

    renderBrandBanner(containerEl, "Settings");

    containerEl.createEl("p", {
      cls: "bs-sub",
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
