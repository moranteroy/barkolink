# Email OTP setup

The app now requests an email code after signup and after Forgot password. Codes are verified by Supabase; the app does not generate or email them itself.

On October 9, 2026, the signup and password recovery OTP templates were applied to the hosted project and verified through the Supabase Management API. Email confirmation is enabled and custom SMTP settings are present. Actual inbox delivery still requires a new code request from the app; previously received emails do not change.

For maintainers, `node scripts/email-otp-setup.mjs` inspects the configuration without printing credentials. `node scripts/email-otp-setup.mjs --apply` backs up and updates only the signup/recovery subjects and bodies, then reads them back to verify the change. Credentials stay in the ignored management environment file.

1. Open your Supabase project → Authentication → Sign In / Providers → Email. Enable **Confirm email** and save. Ensure new user signup is allowed.
2. Open Authentication → Email → Templates (or Email Templates).
3. Set **Confirm signup** to the signup template below, then save.
4. Set **Reset password** to the recovery template below, then save.
5. Configure custom SMTP under Authentication → Email → SMTP Settings to deliver to ordinary Gmail addresses. The default Supabase mail service only supports pre-authorized project team addresses and has restrictive sending limits. Use the SMTP host, port, username, password and verified sender from your email provider. Keep these credentials in Supabase, never in frontend environment variables.
6. Configure the app's Site URL and allowed redirect URLs in Authentication → URL Configuration, including `/login` and `/reset-password` on your app origin for any legacy email links.

## Confirm signup

Subject: `Your BarkoLink verification code`

```html
<h2>Verify your BarkoLink email</h2>
<p>Enter this code in BarkoLink to confirm your email:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>If you did not create an account, ignore this email.</p>
```

## Reset password

Subject: `Your BarkoLink password reset code`

```html
<h2>Reset your BarkoLink password</h2>
<p>Enter this code in BarkoLink to verify your password reset request:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>If you did not request a password reset, ignore this email.</p>
```

Use `{{ .Token }}` in these templates instead of a `{{ .ConfirmationURL }}` button. Configure OTP expiry in the Email provider settings. The app accepts numeric codes, provides a 60-second resend cooldown, and requires a recent recovery verification before changing the password.

After signup verification, the app finishes the passenger profile and returns to sign in. After recovery verification, the app opens Set a new password; saving signs the user out so they can sign in using the new password.

No live email delivery is proven by mocked UI tests. Test with an inbox you control after saving SMTP and template settings.

## Troubleshooting registration and missing codes

- `/verify-email` must stay public in the router: unconfirmed users do not have a session yet. Signup should open this page directly, without requiring sign-in first.
- If Supabase reports `email_not_confirmed` during sign-in, the app requests a fresh confirmation code and opens signup verification. SMTP or rate-limit failures are shown instead of claiming a code was sent.
- An already confirmed account should sign in normally. Signing up again with that email does not establish that another signup email was sent; use Forgot password if access needs to be recovered.
- Clicking an old confirmation link can confirm the email before its final redirect fails at `localhost`. A failed local redirect does not by itself mean the email remains unconfirmed.
- Run `node scripts/verify-email-otp-ui.mjs` against the preview on port 8110 to check guest signup, OTP-page reloads, invalid codes, and unconfirmed sign-in. These checks mock all Supabase requests and send no real email.

Sources: [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Confirm email configuration](https://supabase.com/docs/guides/auth/general-configuration), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
