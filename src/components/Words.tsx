/** Divide um texto em palavras mascaradas (renderizado no servidor) para revelações palavra a palavra. */
export default function Words({ children }: { children: string }) {
  const parts = children.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) => (/^\s+$/.test(p) ? ' ' : p ? <span className="w" key={i}><span className="wi">{p}</span></span> : null))}
    </>
  );
}
