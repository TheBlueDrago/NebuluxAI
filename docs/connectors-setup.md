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
- **WhatsApp** needs nothing. When it's on, replies get a Send to WhatsApp button that opens WhatsApp with the text ready, and the person sends it there.
