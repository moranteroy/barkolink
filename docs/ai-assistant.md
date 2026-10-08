# BarkoLink AI assistant setup

Open `/assistant` or the chat icon in passenger headers. English, Tagalog and Taglish are interpreted by an LLM, not keyword rules. Conversation context is bounded and kept in page memory; leaving the page clears it. Cloudflare credentials belong in server-side secrets and are required for activation.

## Activate when an account is available

1. Create a Cloudflare account. Find the account ID and create an API token with Workers AI Run permission for that account. See [REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).
2. Put `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_TOKEN` in the ignored `.env.chatbot.local` template. Do not paste secrets into chat or put them in `VITE_*` variables. Supabase management credentials remain in the existing ignored `.env.supabase-management` file.
3. Run `node scripts/chatbot-setup.mjs` to check configuration. Run `node scripts/chatbot-setup.mjs --deploy` to apply migration 030, upload secrets and deploy the chatbot Edge Function. All earlier migrations must be present.
4. Run `node scripts/verify-chatbot-provider.mjs` to test the real API with fictional public trip data in all three language styles, including route/date extraction and Philippine clock time. Run `node scripts/verify-chatbot-live.mjs` to check the deployed function's authentication protection. Then test authenticated conversations, follow-ups, route/date ambiguity, payment verification and unknown questions with your passenger account. Database/UI automated tests use mocked AI responses.

Default model: `@cf/qwen/qwen3-30b-a3b-fp8`. Cloudflare documents [multilingual support and function calling](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/). Optional `CHATBOT_MODEL` must support OpenAI-compatible tool calling. Free usage is limited; see [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). Each question normally uses two inference requests (tool selection and grounded response). This model's Cloudflare schema rejects tool-role conversation messages; synthesis therefore receives verified results as explicitly marked JSON data. Event timestamps are serialized with `+08:00` to avoid UTC clock confusion.

## Access and accuracy

The Edge Function verifies the user with Supabase Auth, requires the passenger role and forwards that same user token to database RPCs. It has no service-role database access. Tool names/arguments are validated against a fixed allowlist: schedules, own bookings, own rewards, published advisories, and an application guide. No model-provided SQL, owner ID, write operation, arbitrary network URL or ticket QR token is accepted. Existing `MyLoyalty` may issue earned automatic rewards, as it does on Home; the AI cannot create arbitrary vouchers.

Database results are projected to useful trip/payment details before sending to Cloudflare. Passenger names, email, phone, birth date, raw QR payload, ticket codes, verification secrets and provider payment identifiers are excluded. Booking references are restricted to the current passenger. Messages themselves can contain personal data, so the chat UI explains processing and asks passengers not to send sensitive identifiers. Nothing is stored in a new chat-history table or logged by this function.

Schedules default to departures from today's Philippine date onward, or the requested Philippine date, sorted chronologically. The arrival option filters and sorts by arrival time, including overnight trips departing the previous day. Results are capped at six; the response includes the matching count/scope. Private bookings are sorted newest first, capped at six. Rewards expose values/expiry and progress, not redeemable voucher codes. Sources display verified fields and lookup timestamps alongside the AI response. Reads happen again on every turn; AI text can still contain errors and must not be treated as operational confirmation.

Migration 030 persists per-user usage limits across Edge instances: 12 requests per 10 minutes and 100 per UTC day. There is no paid auto-upgrade. A shared provider quota can still be exhausted by multiple users. Timeouts, quotas, auth failures and database failures produce retry guidance without fabricated data. Missing secrets return an explicit setup message and working links rather than pretending to be an AI.

Before launch: run the setup, verify real English/Tagalog/Taglish behavior with the account's chosen model, check provider data handling for your deployment, and test with separate passenger accounts. The local mocked tests verify data isolation, argument validation, failure handling and UI behavior; they cannot establish live language accuracy.
