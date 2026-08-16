import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-[34rem] rounded-2xl border border-border bg-panel p-12">
        <p className="text-[0.7rem] font-bold tracking-[0.16em] text-gold-accent uppercase">
          Erro 404
        </p>
        <h1 className="font-serif text-[clamp(2.5rem,8vw,4rem)]">Página não encontrada</h1>
        <Link to="/" className="text-gold-accent">
          Voltar à agenda
        </Link>
      </section>
    </main>
  );
}
