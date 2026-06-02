'use client'
import Image from 'next/image'
import { getInitials, generateAvatarColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  online?: boolean
  className?: string
}

export function Avatar({ src, name, size = 40, online, className }: AvatarProps) {
  const initials = getInitials(name)
  const color = generateAvatarColor(name)
  const fontSize = Math.floor(size * 0.36)

  return (
    <div
      className={cn('avatar', online && 'avatar-online', className)}
      style={{
        width: size,
        height: size,
        fontSize,
        background: src ? undefined : color,
        flexShrink: 0,
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{ objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        <span style={{ color: '#fff', fontWeight: 700, userSelect: 'none' }}>{initials}</span>
      )}
    </div>
  )
}
