interface ScoreDotsProps {
  score: number;
  className?: string;
}

export default function ScoreDots({ score, className }: ScoreDotsProps) {
  const filledCount = Math.round(score);
  const filled = "●".repeat(filledCount);
  const empty = "○".repeat(5 - filledCount);

  return (
    <span className={className}>
      <span className="dots-filled">{filled}</span>
      <span className="dots-empty">{empty}</span>
    </span>
  );
}
