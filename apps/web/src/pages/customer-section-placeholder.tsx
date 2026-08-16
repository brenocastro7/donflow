import { ArrowLeft, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router';

export function CustomerSectionPlaceholder({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <main className="relative grid min-h-screen content-center place-items-center bg-[#090a08] px-5 py-24 text-center text-[#c49343]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute top-24 left-4 flex items-center gap-[0.35rem] border-0 bg-transparent text-[#aaa]"
      >
        <ArrowLeft /> Voltar
      </button>
      <div>
        <Scissors />
        <span>Área do cliente</span>
        <h1 className="font-serif text-[2.5rem]">{title}</h1>
        <p className="text-[#85877f]">Esta etapa será configurada a seguir.</p>
      </div>
    </main>
  );
}
