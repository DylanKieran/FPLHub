interface FDRBadgeProps {
  difficulty: number;
  compact?: boolean;
  label?: string;
}

const fdrStyles: Record<number, { bg: string; text: string }> = {
  1: { bg: '#DAFBE1', text: '#1B873B' },
  2: { bg: '#C3F7CB', text: '#1B873B' },
  3: { bg: '#FFF4CC', text: '#BF8700' },
  4: { bg: '#FFCECB', text: '#CF222E' },
  5: { bg: '#F8B4B4', text: '#9E1B1B' },
};

export default function FDRBadge({ difficulty, compact, label }: FDRBadgeProps) {
  const style = fdrStyles[difficulty] || { bg: '#E0E3E8', text: '#5F6672' };

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-sm-design ${
        compact ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs-design'
      }`}
      style={{ background: style.bg, color: style.text }}
    >
      {label || difficulty}
    </span>
  );
}
