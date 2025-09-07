/**
 * Configuration service for managing persistent QuickFind settings.
 * Handles case-sensitive and whole-word search options stored in temp file.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface TextSearchConfig {
  "case-sensitive": boolean;
  "whole-word": boolean;
}

export interface QuickFindConfig {
  "text-search": TextSearchConfig;
}

/**
 * Service for managing QuickFind configuration with persistent storage.
 */
export class ConfigService {
  private configPath: string;
  private config: QuickFindConfig;

  /**
   * Creates a new ConfigService instance and loads existing configuration.
   */
  constructor() {
    this.configPath = path.join(os.tmpdir(), "vscode-quickfind-config.json");
    this.config = this.loadConfig();
  }

  /**
   * Returns the default configuration values.
   */
  private getDefaultConfig(): QuickFindConfig {
    return {
      "text-search": {
        "case-sensitive": false,
        "whole-word": false,
      },
    };
  }

  /**
   * Loads configuration from file, falling back to defaults.
   */
  private loadConfig(): QuickFindConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        const parsedConfig = JSON.parse(configData);

        // Ensure all required properties exist by merging with defaults
        return {
          ...this.getDefaultConfig(),
          ...parsedConfig,
          "text-search": {
            ...this.getDefaultConfig()["text-search"],
            ...(parsedConfig["text-search"] || {}),
          },
        };
      }
    } catch (error) {
      console.error("Error loading QuickFind config:", error);
    }

    return this.getDefaultConfig();
  }

  /**
   * Saves current configuration to file.
   */
  private saveConfig(): void {
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf8",
      );
    } catch (error) {
      console.error("Error saving QuickFind config:", error);
    }
  }

  /**
   * Gets the current text search configuration.
   */
  public getTextSearchConfig(): TextSearchConfig {
    return this.config["text-search"];
  }

  /**
   * Updates text search configuration with partial updates.
   * @param updates - Partial configuration object with properties to update
   */
  public updateTextSearchConfig(updates: Partial<TextSearchConfig>): void {
    this.config["text-search"] = {
      ...this.config["text-search"],
      ...updates,
    };
    this.saveConfig();
  }

  /**
   * Sets case-sensitive search option.
   * @param caseSensitive - Whether to enable case-sensitive searching
   */
  public setCaseSensitive(caseSensitive: boolean): void {
    this.updateTextSearchConfig({ "case-sensitive": caseSensitive });
  }

  /**
   * Sets whole-word search option.
   * @param wholeWord - Whether to enable whole-word matching
   */
  public setWholeWord(wholeWord: boolean): void {
    this.updateTextSearchConfig({ "whole-word": wholeWord });
  }
}
