import { SearchResult } from './fuzzySearchProvider';

export interface FuzzyMatch {
    result: SearchResult;
    score: number;
    matchedIndices: number[];
}

export class FuzzyMatcher {
    private readonly MATCH_BONUS = 16;
    private readonly GAP_PENALTY = -1;
    private readonly FIRST_CHAR_BONUS = 15;
    private readonly CAMEL_BONUS = 30;
    private readonly SEPARATOR_BONUS = 30;
    private readonly LEADING_LETTER_PENALTY = -5;
    private readonly MAX_LEADING_LETTER_PENALTY = -15;

    /**
     * Performs fuzzy matching on search results similar to fzf
     * @param results Array of search results to filter
     * @param query The search query to match against
     * @returns Sorted array of matching results with scores
     */
    fuzzyFilter(results: SearchResult[], query: string): FuzzyMatch[] {
        if (!query.trim()) {
            return results.map(result => ({
                result,
                score: 0,
                matchedIndices: []
            }));
        }

        const matches: FuzzyMatch[] = [];
        const lowercaseQuery = query.toLowerCase();

        for (const result of results) {
            // Create searchable text from filename and line content
            const searchText = this.getSearchableText(result);
            const match = this.calculateMatch(searchText, lowercaseQuery);
            
            if (match.score > 0) {
                matches.push({
                    result,
                    score: match.score,
                    matchedIndices: match.matchedIndices
                });
            }
        }

        // Sort by score (higher is better) and then by line number for consistency
        matches.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            return a.result.line - b.result.line;
        });

        return matches;
    }

    /**
     * Creates searchable text from a search result
     * Combines filename and line content for comprehensive matching
     */
    private getSearchableText(result: SearchResult): string {
        const filename = result.file.split('/').pop() || '';
        return `${filename} ${result.text}`.toLowerCase();
    }

    /**
     * Calculate fuzzy match score prioritizing consecutive matches
     */
    private calculateMatch(text: string, query: string): { score: number; matchedIndices: number[] } {
        if (query.length === 0) {
            return { score: 0, matchedIndices: [] };
        }

        const textLen = text.length;
        const queryLen = query.length;

        if (queryLen > textLen) {
            return { score: 0, matchedIndices: [] };
        }

        // First, try to find exact consecutive substring matches
        const exactMatch = this.findExactMatch(text, query);
        if (exactMatch) {
            return exactMatch;
        }

        // Then try to find best consecutive partial matches
        const consecutiveMatch = this.findBestConsecutiveMatch(text, query);
        if (consecutiveMatch && consecutiveMatch.score > 0) {
            return consecutiveMatch;
        }

        // Only fall back to fuzzy if consecutive matching fails
        const fuzzyMatch = this.findFuzzyMatch(text, query);
        return fuzzyMatch;
    }

    /**
     * Find exact consecutive substring matches
     */
    private findExactMatch(text: string, query: string): { score: number; matchedIndices: number[] } | null {
        const exactIndex = text.indexOf(query);
        if (exactIndex !== -1) {
            const matchedIndices = Array.from(
                { length: query.length }, 
                (_, i) => exactIndex + i
            );
            return {
                score: 1000 + this.MATCH_BONUS * query.length + this.getPositionBonus(exactIndex, text.length),
                matchedIndices
            };
        }
        return null;
    }

    /**
     * Find best consecutive partial match (e.g., "err" in "Error")
     */
    private findBestConsecutiveMatch(text: string, query: string): { score: number; matchedIndices: number[] } | null {
        let bestScore = 0;
        let bestMatch: number[] = [];

        // Try each possible starting position
        for (let start = 0; start <= text.length - query.length; start++) {
            let matchedIndices: number[] = [];
            let currentPos = start;
            let queryPos = 0;
            let consecutiveMatches = 0;
            let maxConsecutive = 0;

            // Try to match as many consecutive characters as possible from this position
            while (currentPos < text.length && queryPos < query.length) {
                if (text[currentPos].toLowerCase() === query[queryPos].toLowerCase()) {
                    matchedIndices.push(currentPos);
                    queryPos++;
                    consecutiveMatches++;
                    maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
                } else {
                    consecutiveMatches = 0;
                }
                currentPos++;
            }

            // Only consider if we matched all query characters
            if (queryPos === query.length) {
                let score = 500; // Base score for completing the match
                
                // Big bonus for consecutive matches
                score += maxConsecutive * 50;
                
                // Bonus for word boundaries
                if (start === 0 || this.isSeparator(text[start - 1])) {
                    score += 100;
                }
                
                // Position bonus (earlier is better)
                score += this.getPositionBonus(start, text.length);
                
                // Small penalty for total length of match
                const matchLength = matchedIndices[matchedIndices.length - 1] - matchedIndices[0] + 1;
                score -= matchLength * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = [...matchedIndices];
                }
            }
        }

        return bestMatch.length > 0 ? { score: bestScore, matchedIndices: bestMatch } : null;
    }

    /**
     * Fall back to fuzzy matching if consecutive fails
     */
    private findFuzzyMatch(text: string, query: string): { score: number; matchedIndices: number[] } {
        const matchedIndices = this.findSequentialMatches(text, query);
        if (matchedIndices.length !== query.length) {
            return { score: 0, matchedIndices: [] };
        }

        // Much lower base score for fuzzy matches
        let score = 50; 
        let lastIndex = -1;

        for (let i = 0; i < matchedIndices.length; i++) {
            const index = matchedIndices[i];
            score += 5; // Lower bonus for fuzzy matches
            
            // Heavy penalty for gaps between matches
            if (lastIndex >= 0) {
                const gap = index - lastIndex - 1;
                score -= gap * 10; // Much higher gap penalty
            }
            
            lastIndex = index;
        }

        return { score: Math.max(0, score), matchedIndices };
    }

    /**
     * Find all characters of query in text, in order but not necessarily consecutive
     * Prioritizes word boundaries and consecutive matches
     */
    private findSequentialMatches(text: string, query: string): number[] {
        // Try to find the best possible match by exploring all valid sequences
        const bestMatch = this.findBestSequentialMatch(text, query, 0, 0, []);
        return bestMatch || [];
    }

    /**
     * Recursively find the best sequential match with backtracking
     */
    private findBestSequentialMatch(
        text: string, 
        query: string, 
        textIndex: number, 
        queryIndex: number, 
        currentMatches: number[]
    ): number[] | null {
        // If we've matched all query characters, return the current matches
        if (queryIndex >= query.length) {
            return [...currentMatches];
        }

        // If we've exhausted the text, no match possible
        if (textIndex >= text.length) {
            return null;
        }

        const queryChar = query[queryIndex];
        let bestMatch: number[] | null = null;
        let bestScore = -Infinity;

        // Try finding the query character at different positions
        for (let j = textIndex; j < text.length; j++) {
            if (text[j] === queryChar) {
                const newMatches = [...currentMatches, j];
                
                // Recursively try to match the rest
                const remainingMatch = this.findBestSequentialMatch(
                    text, query, j + 1, queryIndex + 1, newMatches
                );

                if (remainingMatch) {
                    // Score this potential match
                    const score = this.scoreMatchSequence(text, remainingMatch, query);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = remainingMatch;
                    }
                }
            }
        }

        return bestMatch;
    }

    /**
     * Score a sequence of matches to determine quality
     */
    private scoreMatchSequence(text: string, matches: number[], query: string): number {
        let score = 0;
        
        for (let i = 0; i < matches.length; i++) {
            const index = matches[i];
            
            // Bonus for word boundaries (start of word)
            if (index === 0 || this.isSeparator(text[index - 1])) {
                score += 50;
            }
            
            // Bonus for camelCase boundaries
            if (this.isCamelCase(text, index)) {
                score += 30;
            }
            
            // Bonus for consecutive matches
            if (i > 0 && matches[i] === matches[i - 1] + 1) {
                score += 20;
            }
            
            // Penalty for position (earlier is better)
            score -= index * 0.1;
            
            // Penalty for gaps between matches
            if (i > 0) {
                const gap = matches[i] - matches[i - 1] - 1;
                score -= gap * 2;
            }
        }
        
        return score;
    }

    /**
     * Backtrack through the DP table to find matched character indices
     */
    private backtrack(dp: number[][], matches: boolean[][], query: string, text: string): number[] {
        const matchedIndices: number[] = [];
        let i = query.length;
        let j = text.length;

        while (i > 0 && j > 0) {
            if (matches[i][j]) {
                matchedIndices.unshift(j - 1);
                i--;
                j--;
            } else {
                j--;
            }
        }

        return matchedIndices;
    }

    /**
     * Calculate bonus score based on character position and type
     */
    private getCharBonus(text: string, index: number): number {
        let bonus = 0;

        // First character bonus
        if (index === 0) {
            bonus += this.FIRST_CHAR_BONUS;
        }

        // Character after separator (space, slash, etc.)
        if (index > 0) {
            const prevChar = text[index - 1];
            if (this.isSeparator(prevChar)) {
                bonus += this.SEPARATOR_BONUS;
            } else if (this.isCamelCase(text, index)) {
                bonus += this.CAMEL_BONUS;
            }
        }

        // Penalty for leading letters
        if (index > 0 && this.isLetter(text[index])) {
            let leading = 0;
            for (let k = index - 1; k >= 0; k--) {
                if (!this.isLetter(text[k])) {
                    break;
                }
                leading++;
            }
            bonus += Math.max(
                this.MAX_LEADING_LETTER_PENALTY,
                this.LEADING_LETTER_PENALTY * leading
            );
        }

        return bonus;
    }

    /**
     * Calculate position bonus (earlier matches score higher)
     */
    private getPositionBonus(index: number, textLength: number): number {
        return Math.max(0, 50 - (index * 50) / textLength);
    }

    /**
     * Check if character is a separator
     */
    private isSeparator(char: string): boolean {
        return /[\s\-_/.\\]/.test(char);
    }

    /**
     * Check if position represents camelCase transition
     */
    private isCamelCase(text: string, index: number): boolean {
        if (index === 0) {return false;}
        const prevChar = text[index - 1];
        const currentChar = text[index];
        return (
            prevChar.toLowerCase() === prevChar &&
            currentChar.toUpperCase() === currentChar &&
            this.isLetter(currentChar)
        );
    }

    /**
     * Check if character is a letter
     */
    private isLetter(char: string): boolean {
        return /[a-zA-Z]/.test(char);
    }

    /**
     * Highlight matched characters in text for display
     */
    highlightMatches(text: string, matchedIndices: number[]): string {
        if (matchedIndices.length === 0) {
            return text;
        }

        let result = '';
        let lastIndex = 0;

        for (const index of matchedIndices) {
            if (index >= text.length) {continue;}
            
            // Add text before the match
            result += text.substring(lastIndex, index);
            
            // Add highlighted character
            result += `<span class="highlight">${text[index]}</span>`;
            
            lastIndex = index + 1;
        }

        // Add remaining text
        result += text.substring(lastIndex);
        
        return result;
    }
}