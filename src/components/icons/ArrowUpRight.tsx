type Props = { className?: string }

export function ArrowUpRight({ className = 'w-3 h-3 inline ml-0.5 -mt-0.5' }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6.65C9 6.65 15.94 6.11 16.92 7.08C17.89 8.06 17.35 15 17.35 15M16.5 7.5L6.5 17.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  )
}
