// cannedResponses.ts
import rawCannedResponses from './cannedResponses.json'; // Import the JSON data

// Interface to represent the structure of a raw canned response object from the JSON file.
interface JsonCannedResponse {
  keywords: {
    all?: string[]; // Array of keywords, all of which must be present in the input.
    any?: string[]; // Array of keywords, at least one of which must be present in the input.
    alwaysMatch?: boolean; // A special flag for a rule that should always match (e.g., a default fallback).
  };
  response: string; // The text of the canned response.
  description?: string; // An optional human-readable description of the rule for display.
}

// Interface to represent the structure of a processed canned response rule
// that will be used by the main application logic (e.g., App.tsx).
interface CannedResponseRule {
  test: (input: string) => boolean; // A function that takes user input and returns true if the rule matches.
  response: string; // The canned response text.
  description?: string; // The description of the rule for display.
}

// This array is created by mapping over the raw JSON data.
// For each raw rule, it constructs a CannedResponseRule object,
// dynamically creating the 'test' function based on the 'keywords' in the JSON.
export const cannedResponses: CannedResponseRule[] = rawCannedResponses.map(
  (rawRule: JsonCannedResponse) => {
    return {
      test: (input: string) => {
        const lowerInput = input.toLowerCase(); // Convert input to lowercase for case-insensitive matching.

        // If the 'alwaysMatch' flag is true, this rule matches regardless of input.
        // This is typically used for the final, default fallback response.
        if (rawRule.keywords.alwaysMatch) {
          return true;
        }

        // Check for 'all' keywords:
        // If 'all' keywords are defined, ensure EVERY keyword in that array is present in the lowercase input.
        if (rawRule.keywords.all && rawRule.keywords.all.length > 0) {
          const allMatch = rawRule.keywords.all.every(keyword =>
            lowerInput.includes(keyword.toLowerCase())
          );
          if (allMatch) return true; // If all required keywords are found, the rule matches.
        }

        // Check for 'any' keywords:
        // If 'any' keywords are defined, ensure AT LEAST ONE keyword in that array is present in the lowercase input.
        if (rawRule.keywords.any && rawRule.keywords.any.length > 0) {
          const anyMatch = rawRule.keywords.any.some(keyword =>
            lowerInput.includes(keyword.toLowerCase())
          );
          if (anyMatch) return true; // If any of the keywords are found, the rule matches.
        }

        // If none of the keyword conditions for this rule are met, the rule does not match the input.
        return false;
      },
      response: rawRule.response, // Assign the response text directly from the JSON.
      description: rawRule.description, // Assign the description directly from the JSON.
    };
  }
);
