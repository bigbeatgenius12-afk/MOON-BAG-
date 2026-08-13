// Coin logo that supports "live" animated logos: when the coin's image URL
// points at a video file, render a silent auto-playing loop instead of a
// static image — like watching a tiny cartoon movie on the coin.
export function CoinLogo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const isVideo = /\.(mp4|webm|mov)$/i.test(src.split("?")[0] ?? "");
  if (isVideo) {
    return (
      <video
        src={src}
        // Show the coin's static logo instantly while the movie loads
        poster={src.replace(/\.(mp4|webm|mov)$/i, ".png")}
        aria-label={alt}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
    );
  }
  return <img src={src} alt={alt} className={className} />;
}
