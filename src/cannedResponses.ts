// cannedResponses.ts
import rawCannedResponses from './cannedResponses.json'; // Import the JSON data

// Interface to represent the structure of a raw canned response object from the JSON file.
interface JsonCannedResponse {
  keywords: {
    all?: string[]; // Array of keywords, all of which must be present in the input.
    any?: string[]; // Array of keywords, at least one of which must be present in the input.
    alwaysMatch?: boolean; // A special flag for a rule that should always alwaysMatch (e.g., a default fallback).
  };
  response: string; // The text of the canned response.
  description?: string; // An optional human-readable description of the rule for display.
}

// Interface to represent the structure of a processed canned response rule
// that will be used by the main application logic (e.g., App.tsx).
export interface CannedResponseRule {
  test: (input: string) => boolean; // A function that takes user input and returns true if the rule matches.
  response: string; // The canned response text.
  description?: string; // The description of the rule for display.
  prompt?: string | null; // The actual prompt text to display for the clickable button. Can be undefined or null.
  // Add keywords to CannedResponseRule so you can filter on them in App.tsx
  // This is a common pattern: enriching the data structure that's exported.
  keywords: {
    all?: string[];
    any?: string[];
    alwaysMatch?: boolean;
  };
}

// This array is created by mapping over the raw JSON data.
// For each raw rule, it constructs a CannedResponseRule object,
// dynamically creating the 'test' function based on the 'keywords' in the JSON.
export const cannedResponses: CannedResponseRule[] = rawCannedResponses.map(
  (rawRule: JsonCannedResponse) => {
    let effectivePrompt: string | undefined | null = undefined; // Initialize to undefined

    // Determine the prompt text for the clickable button:
    // This logic ensures that if you explicitly set `prompt: null` in your JSON (though you removed it),
    // or if no keywords exist, no button will be created.
    if (rawRule.keywords.any && rawRule.keywords.any.length > 0) {
      effectivePrompt = rawRule.keywords.any[0].charAt(0).toUpperCase() + rawRule.keywords.any[0].slice(1);
    } else if (rawRule.keywords.all && rawRule.keywords.all.length > 0) {
      effectivePrompt = rawRule.keywords.all.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' ');
    } else if (rawRule.keywords.alwaysMatch) {
      effectivePrompt = null; // Don't show a prompt for an always-matching fallback
    }

    // Special handling for "Gordon" transaction history:
    // If the rule matches "gordon" AND "1234" AND "transaction", force its specific prompt.
    // This overrides any generic prompt derivation for this specific case.
    if (rawRule.keywords.all?.includes("gordon") &&
        rawRule.keywords.all?.includes("1234") &&
        rawRule.keywords.all?.includes("transaction")) {
      effectivePrompt = "Gordon 1234 Transaction history"; // This is the internal query string
    }

    return {
      test: (input: string) => {
        const lowerInput = input.toLowerCase();

        if (rawRule.keywords.alwaysMatch) {
          return true;
        }

        if (rawRule.keywords.all && rawRule.keywords.all.length > 0) {
          const allMatch = rawRule.keywords.all.every(keyword =>
            lowerInput.includes(keyword.toLowerCase())
          );
          if (allMatch) return true;
        }

        if (rawRule.keywords.any && rawRule.keywords.any.length > 0) {
          const anyMatch = rawRule.keywords.any.some(keyword =>
            lowerInput.includes(keyword.toLowerCase())
          );
          if (anyMatch) return true;
        }

        return false;
      },
      response: rawRule.response,
      description: rawRule.description,
      prompt: effectivePrompt,
      // Crucially, include the raw keywords in the exported CannedResponseRule
      keywords: rawRule.keywords,
    };
  }
);