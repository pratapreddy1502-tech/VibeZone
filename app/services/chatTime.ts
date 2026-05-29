function parseChatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasTimezone ? value : `${value}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatChatListTime(value?: string | null) {
  const date = parseChatDate(value);

  if (!date) {
    return '';
  }

  const now = new Date();
  const diffMinutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  if (diffMinutes < 1440 && startOfDay(now) === startOfDay(date)) {
    return `${Math.floor(diffMinutes / 60)}h`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (startOfDay(yesterday) === startOfDay(date)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMessageClock(value?: string | null) {
  const date = parseChatDate(value);

  if (!date) {
    return '';
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateSeparator(value?: string | null) {
  const date = parseChatDate(value);

  if (!date) {
    return '';
  }

  const now = new Date();

  if (startOfDay(now) === startOfDay(date)) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (startOfDay(yesterday) === startOfDay(date)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function shouldShowDateSeparator(
  current?: string | null,
  previous?: string | null
) {
  const currentDate = parseChatDate(current);
  const previousDate = parseChatDate(previous);

  if (!currentDate) {
    return false;
  }

  if (!previousDate) {
    return true;
  }

  return startOfDay(currentDate) !== startOfDay(previousDate);
}

export function formatActiveStatus(isOnline: boolean, lastSeen?: string | null) {
  if (isOnline) {
    return 'Active now';
  }

  const date = parseChatDate(lastSeen);

  if (!date) {
    return 'Offline';
  }

  const diffMinutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'Active now';
  }

  if (diffMinutes < 60) {
    return `Active ${diffMinutes}m ago`;
  }

  if (diffMinutes < 1440) {
    return `Active ${Math.floor(diffMinutes / 60)}h ago`;
  }

  return 'Offline';
}
