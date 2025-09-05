import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TextSearchConfig {
    'case-sensitive': boolean;
    'whole-word': boolean;
}

export interface QuickFindConfig {
    'text-search': TextSearchConfig;
}

export class ConfigService {
    private configPath: string;
    private config: QuickFindConfig;

    constructor() {
        this.configPath = path.join(os.tmpdir(), 'vscode-quickfind-config.json');
        this.config = this.loadConfig();
    }

    private getDefaultConfig(): QuickFindConfig {
        return {
            'text-search': {
                'case-sensitive': false,
                'whole-word': false
            }
        };
    }

    private loadConfig(): QuickFindConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const parsedConfig = JSON.parse(configData);
                
                // Ensure all required properties exist by merging with defaults
                return {
                    ...this.getDefaultConfig(),
                    ...parsedConfig,
                    'text-search': {
                        ...this.getDefaultConfig()['text-search'],
                        ...(parsedConfig['text-search'] || {})
                    }
                };
            }
        } catch (error) {
            console.error('Error loading QuickFind config:', error);
        }
        
        return this.getDefaultConfig();
    }

    private saveConfig(): void {
        try {
            // Ensure the directory exists
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving QuickFind config:', error);
        }
    }

    public getTextSearchConfig(): TextSearchConfig {
        return this.config['text-search'];
    }

    public updateTextSearchConfig(updates: Partial<TextSearchConfig>): void {
        this.config['text-search'] = {
            ...this.config['text-search'],
            ...updates
        };
        this.saveConfig();
    }

    public setCaseSensitive(caseSensitive: boolean): void {
        this.updateTextSearchConfig({ 'case-sensitive': caseSensitive });
    }

    public setWholeWord(wholeWord: boolean): void {
        this.updateTextSearchConfig({ 'whole-word': wholeWord });
    }
}