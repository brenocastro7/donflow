export function profileImageDataUrl(user: {
  id: string;
  profileImageKey?: string | null;
  profileImage?: Uint8Array | null;
  profileImageMimeType?: string | null;
  updatedAt?: Date;
}): string | null {
  if (user.profileImageKey) {
    const version = user.updatedAt ? `?v=${user.updatedAt.getTime()}` : '';
    const apiPublicUrl = process.env.API_PUBLIC_URL?.trim().replace(/\/$/, '');
    return `${apiPublicUrl ?? ''}/api/media/profile-images/${user.id}${version}`;
  }
  if (user.profileImage && user.profileImageMimeType) {
    return `data:${user.profileImageMimeType};base64,${Buffer.from(user.profileImage).toString('base64')}`;
  }
  return null;
}
