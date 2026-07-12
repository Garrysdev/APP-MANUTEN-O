import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

export default function Avatar({ name, avatarUrl, size = 24, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover flex-shrink-0', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={cn('rounded-full bg-[#2E86C1] flex items-center justify-center flex-shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
        {initials}
      </span>
    </div>
  )
}
