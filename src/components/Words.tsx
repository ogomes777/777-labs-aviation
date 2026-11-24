/** Divide um texto em palavras mascaradas (renderizado no servidor) para revelações palavra a palavra. */
export default function Words({ children, offset = 0 }: { children: string; offset?: number }) {
  const parts = children.split(/(\s+)/);
  let n = offset;
  return (
    <>
      {parts.map((p, i) => (/^\s+$/.test(p) ? ' ' : p ? <span className="w" key={i} style={{ ['--i' as string]: n++ } as React.CSSProperties}><span className="wi">{p}</span></span> : null))}
    </>
  );
}
