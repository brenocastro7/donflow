type UserAvatarProps = {
  name: string;
  profileImageDataUrl?: string | null;
  className?: string;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function UserAvatar({ name, profileImageDataUrl, className }: UserAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      {profileImageDataUrl ? (
        <img
          className="block size-full rounded-[inherit] object-cover"
          src={profileImageDataUrl}
          alt=""
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
