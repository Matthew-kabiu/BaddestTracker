/** Random per-tab id, sent as `X-Client-Id` so this tab can recognise its own live events. */
export const CLIENT_ID = crypto.randomUUID()
