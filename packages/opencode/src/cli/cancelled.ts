import { Schema } from "effect"

// Kept out of `cli/ui.ts` so importing the UI (logo, error formatting) does not
// pull the Effect runtime into startup. The tag stays `UICancelledError` for
// backward-compatible error formatting.
export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}
