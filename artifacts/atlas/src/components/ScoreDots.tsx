interface ScoreDotsProps {
  score: number;
  className?: string;
}

// Five dots: filled for the score, rings for the rest
export default function ScoreDots({ score, className }: ScoreDotsProps) {
  const filledCount = Math.round(score);
  return (
    <span className={className} role="img" aria-label={`${filledCount} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`rating-dot ${i < filledCount ? "filled" : "empty"}`} />
      ))}
    </span>
  );
}
