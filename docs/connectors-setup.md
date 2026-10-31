# Setting up the connectors

Nebulux AI and Nebulux Orbit share one set of connectors. If you connect an app in one of them, it works in the other too. The code is in `cloudflare-lib/apps.js`, and the endpoint is `functions/v1/connect`.

Until you do the steps below for an app, it shows as **Not set up yet**. It starts working as soon as its two secrets are set. Nothing else needs to change.

## The same steps for every app

1. Make a developer app on that company's site (links below). Use the free tier and don't add a card.
2. Set its redirect address (also called a callback URL or redirect URI) to exactly this:
   `https://nebuluxai.com/v1/connect/callback`
3. Turn on the permissions (scopes) listed for that app.
4. Copy the app's client ID and client secret into the **Nebulux AI** Pages project (Cloudflare dashboard → Workers & Pages → nebuluxai → Settings → Variables and secrets, as *Secret*):
   `<NAME>_CLIENT_ID` and `<NAME>_CLIENT_SECRET`
5. Redeploy, or push any change to main.

The secrets go only in Cloudflare. Never put them in the code or send them to anyone.

| App | Secret names | Where to make the app | Permissions to turn on | Notes |
|---|---|---|---|---|
| Notion | `NOTION_` | notion.so/profile/integrations → New integration → **Public** | Read content | Each person picks which pages Nebulux can see. |
| Slack | `SLACK_` | api.slack.com/apps → Create New App | **User** token scopes: channels:read, channels:history, groups:read, groups:history, users:read, chat:write | Under OAuth & Permissions, add the redirect URL. |
| Spotify | `SPOTIFY_` | developer.spotify.com/dashboard | user-read-currently-playing, user-read-recently-played, user-top-read, playlist-read-private | Development mode allows up to 25 people, and you add each one in the dashboard. |
| Discord | `DISCORD_` | discord.com/developers/applications → OAuth2 | identify, guilds, webhook.incoming | The person picks the channel that Nebulux can post to. |
| X | `X_` | developer.x.com → Projects & Apps | OAuth 2.0 on, type **Web App (confidential)**; tweet.read, users.read, tweet.write, offline.access | The free tier reads very little and posts about 500 times a month for the whole app. |
| Reddit | `REDDIT_` | reddit.com/prefs/apps → create app → **web app** | identity, read, mysubreddits, history | Reddit may ask you to fill in its API access form first. |
| Pinterest | `PINTEREST_` | developers.pinterest.com/apps | user_accounts:read, boards:read, pins:read | Starts with Trial access. |
| TikTok | `TIKTOK_` (the client **key** goes in `TIKTOK_CLIENT_ID`) | developers.tiktok.com → Manage apps | Login Kit; user.info.basic, video.list | TikTok reviews the app before other people can use it. |
| Instagram | `INSTAGRAM_` | developers.facebook.com → Create app → Instagram → **API setup with Instagram login** | instagram_business_basic | Works only with business and creator accounts. Meta reviews it before the public can use it. |
| Dropbox | `DROPBOX_` | dropbox.com/developers/apps | account_info.read, files.metadata.read | |
| Outlook, OneDrive, Microsoft To Do | `MICROSOFT_` (one app covers all three) | portal.azure.com → App registrations → New, "Accounts in any organizational directory and personal Microsoft accounts", platform **Web** | Delegated: User.Read, Mail.Read, Calendars.Read, Files.Read, Tasks.Read, offline_access | Make a client secret under Certificates & secrets. |
| Todoist | `TODOIST_` | developer.todoist.com/appconsole.html | data:read_write | |
| Asana | `ASANA_` | app.asana.com/0/my-apps | Default (full) permissions | |
| Linear | `LINEAR_` | linear.app/settings/api/applications | read | |
| Zoom | `ZOOM_` | marketplace.zoom.us → Develop → Build App → **General app**, user-managed | meeting:read:list_meetings, user:read:user | |
| Twitch | `TWITCH_` | dev.twitch.tv/console/apps | user:read:follows | Client type: Confidential. |

## Apps that use the Google or GitHub apps you already have

- **Gmail, Google Calendar, Drive, Tasks, YouTube**: these already work.
- **Google Contacts** uses the same Google app. In Google Cloud Console → APIs & Services:
  1. Turn on the **People API**.
  2. Add the scope `.../auth/contacts.readonly` to the OAuth consent screen (Google Auth Platform → Data access).
- **Google Keep** isn't offered. Google only allows its API for school and work (Workspace) accounts, and it refuses the `keep.readonly` scope for the Nebulux Google app.
- **GitHub** uses the Nebulux Code GitHub app that's already set up.
- **WhatsApp** works without setup as a Send to WhatsApp button (it opens WhatsApp with the text ready, and the person sends it there). For the real connection, see below.

## WhatsApp: the real connection (optional)

With this, people link their own WhatsApp by sending a code to Nebulux's WhatsApp number. Then they can chat with Nebulux AI inside WhatsApp, and say "send this to my WhatsApp" in a Nebulux AI chat. It uses Meta's official WhatsApp Business Platform. Code: `cloudflare-lib/whatsapp.js` and the webhook `functions/v1/whatsapp.js`.

What WhatsApp allows: Nebulux only messages a person's own number, and only within 24 hours of their last message to it. It never reads or sends anyone's personal chats. Replies to people who message first are free on Meta's side; Nebulux never starts a conversation, which is the part Meta charges for. Each person gets up to 30 answers a day there.

1. On [developers.facebook.com](https://developers.facebook.com/apps), press **Create app** and pick the **Connect with customers through WhatsApp** use case. Connect it to a Meta business portfolio (make one if it asks).
2. In the app, open **WhatsApp → API Setup**.
   - Meta gives you a free **test number**. It can only message up to 5 numbers that you add there, which is fine for trying it.
   - For everyone, add your own number under **Add phone number**. It must be a number that isn't already on WhatsApp. Verify it by text or call, and set the display name (for example "Nebulux AI").
   - Copy the number's **Phone number ID**.
3. Make a token that doesn't expire: [business.facebook.com/settings](https://business.facebook.com/settings) → **Users → System users** → **Add** (Admin). Press **Add assets**, give it the app and the WhatsApp account with full control, then **Generate new token** with `whatsapp_business_messaging` and `whatsapp_business_management`, set to never expire.
4. Copy the **App secret** from the app's **App settings → Basic**.
5. Make up a **verify token**: any long random text.
6. In Cloudflare (the Nebulux AI Pages project → Settings → Variables and secrets), add four secrets, then redeploy:
   - `WHATSAPP_TOKEN`: the token from step 3
   - `WHATSAPP_PHONE_ID`: the Phone number ID from step 2
   - `WHATSAPP_APP_SECRET`: the App secret from step 4
   - `WHATSAPP_VERIFY_TOKEN`: the text from step 5
7. Back in the Meta app, open **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://nebuluxai.com/v1/whatsapp`
   - Verify token: the same text as step 5
   - Press **Verify and save**, then under **Webhook fields** subscribe to **messages**.
8. In **App settings → Basic**, set the Privacy Policy URL to `https://nebuluxai.com/privacy`, then switch the app to **Live**.
9. Try it: Nebulux AI → Settings → Connectors → WhatsApp → **Connect**, then send the code from your WhatsApp.

Meta may ask you to verify the business (an LLC's documents work) before more people can use it, or ask for a payment method on the WhatsApp account. Nebulux only sends replies, which aren't charged, so skip anything that needs a card.
