export type CachedCommunityChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  pending?: boolean;
};

export type CachedCommunityChatPlayer = {
  userId: string;
  name: string;
  avatar?: string;
};

export type CachedCommunityChat = {
  messages: CachedCommunityChatMessage[];
  otherPlayer: CachedCommunityChatPlayer | null;
  updatedAt: number;
};

const MAX_MESSAGES_PER_CHAT = 100;
const MAX_CACHED_CHATS = 20;

const communityChatCache = new Map<
  string,
  CachedCommunityChat
>();

function normalizeMessages(
  messages: CachedCommunityChatMessage[],
) {
  return messages.slice(-MAX_MESSAGES_PER_CHAT);
}

function enforceChatLimit() {
  if (communityChatCache.size <= MAX_CACHED_CHATS) {
    return;
  }

  const oldest = [...communityChatCache.entries()].sort(
    (a, b) => a[1].updatedAt - b[1].updatedAt,
  )[0];

  if (oldest) {
    communityChatCache.delete(oldest[0]);
  }
}

export function getCachedCommunityChat(
  conversationId: string | number,
): CachedCommunityChat | null {
  const key = String(conversationId);
  const cached = communityChatCache.get(key);

  if (!cached) {
    return null;
  }

  return {
    messages: [...cached.messages],
    otherPlayer: cached.otherPlayer
      ? { ...cached.otherPlayer }
      : null,
    updatedAt: cached.updatedAt,
  };
}

export function setCachedCommunityChat(
  conversationId: string | number,
  chat: Omit<CachedCommunityChat, "updatedAt">,
) {
  const key = String(conversationId);

  communityChatCache.set(key, {
    messages: normalizeMessages(chat.messages),
    otherPlayer: chat.otherPlayer
      ? { ...chat.otherPlayer }
      : null,
    updatedAt: Date.now(),
  });

  enforceChatLimit();
}

export function updateCachedCommunityChatMessages(
  conversationId: string | number,
  messages: CachedCommunityChatMessage[],
) {
  const key = String(conversationId);
  const existing = communityChatCache.get(key);

  communityChatCache.set(key, {
    messages: normalizeMessages(messages),
    otherPlayer: existing?.otherPlayer ?? null,
    updatedAt: Date.now(),
  });

  enforceChatLimit();
}

export function clearCachedCommunityChat(
  conversationId: string | number,
) {
  communityChatCache.delete(String(conversationId));
}

export function clearCommunityChatCache() {
  communityChatCache.clear();
}
