let stringComparison = require('string-comparison').default;

export function hasKeyword(...keywords: string[]): (prompt: string) => boolean {
    // Return a function that takes the prompt as an argument
    return (prompt: string): boolean => {
        // Convert prompt to lowercase and trim whitespace for consistent matching
        const normalizedPrompt = prompt.toLowerCase().trim();
        
        // Check if any of the keywords exist in the normalized prompt
        return keywords.some(keyword => 
            // Normalize each keyword as well for consistent comparison
            normalizedPrompt.includes(keyword.toLowerCase().trim())
        );
    };
}

/**
 * Calculates string similarity using the string-comparison library's Levenshtein implementation
 * and determines if a prompt is semantically related to any given keywords based on a similarity threshold.
 * 
 * The function combines both direct Levenshtein similarity and word-based matching to provide
 * more accurate results for longer text comparisons.
 * 
 * @param {string[]} keywords - Array of keywords to check for similarity
 * @param {number} [threshold=0.7] - Similarity threshold (0 to 1, default 0.7)
 * @returns {(prompt: string) => boolean} - Function that evaluates prompt similarity
 * 
 * @example
 * const prompt = "Can you generate a market summary?";
 * const checker = isPromptRelatedTo(['generate summary', 'create summary'], 0.75);
 * const result = checker(prompt); // returns true if similarity > 0.75
 */
export function isPromptRelatedTo(keywords: string[], threshold: number = 0.6): (prompt: string) => boolean {
    // Helper function to normalize text by removing extra spaces and converting to lowercase
    function normalizeText(text: string): string {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    // Helper function to create a set of words for word-based matching
    function createWordSet(text: string): Set<string> {
        return new Set(normalizeText(text).split(' '));
    }

    // Calculate word-based similarity using Jaccard similarity coefficient
    function calculateWordSimilarity(str1: string, str2: string): number {
        const set1 = createWordSet(str1);
        const set2 = createWordSet(str2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    // Return a function that evaluates the prompt against the keywords
    return (prompt: string): boolean => {
        const normalizedPrompt = normalizeText(prompt);
        
        return keywords.some(keyword => {
            const normalizedKeyword = normalizeText(keyword);
            
            // Calculate Levenshtein similarity using the library
            const levenshteinSimilarity = stringComparison.levenshtein.similarity(
                normalizedPrompt,
                normalizedKeyword
            );
            
            // Calculate word-based similarity for better handling of word order
            const wordSimilarity = calculateWordSimilarity(
                normalizedPrompt,
                normalizedKeyword
            );
            
            // Combine both similarity measures with weights
            // We give more weight to word similarity for longer phrases
            const combinedSimilarity = (levenshteinSimilarity * 0.5) + (wordSimilarity * 0.7);
            
            // Return true if the combined similarity exceeds the threshold
            return combinedSimilarity >= threshold;
        });
    };
}